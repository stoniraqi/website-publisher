import { and, asc, count, desc, eq, like, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, content, contentTerms, revisions, settings, terms, users } from "@/db/schema";
import { type Block, blocksSchema, blocksText, normalizeBlocks, parseBlocks, slugify } from "@/server/blocks";
import { AppError, forbidden, invalid, notFound } from "@/server/errors";
import {
  type Actor,
  canCreate,
  canEdit,
  canEditOthers,
  canPublish,
  canRead,
  canSetStatus,
  type ContentType,
  type Status,
  STATUSES,
} from "@/server/permissions";
import { getSettings } from "@/server/settings";
import { existingCategoryIds, tagIdsFor, termsOf, UNCATEGORIZED } from "@/server/terms";

export const PAGE_SIZE = 20;

/** Scheduled items whose time has come are published. */
export async function promoteDue(): Promise<void> {
  await db
    .update(content)
    .set({ status: "published" })
    .where(and(eq(content.status, "scheduled"), sql`${content.publishAt} <= ${Date.now()}`));
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  excerpt: string;
  blocks: Block[];
  status: Status;
  publishAt: number | null;
  authorId: string;
  parentId: string | null;
  commentsOpen: boolean;
  createdAt: number;
  updatedAt: number;
}

type Row = typeof content.$inferSelect;
function toItem(row: Row): ContentItem {
  return {
    id: row.id,
    type: row.type as ContentType,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    blocks: parseBlocks(row.blocks),
    status: row.status as Status,
    publishAt: row.publishAt,
    authorId: row.authorId,
    parentId: row.parentId,
    commentsOpen: row.commentsOpen,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** What the person may see in the dashboard. */
function visibleTo(actor: Actor): SQL | undefined {
  if (canEditOthers(actor)) return undefined;
  return or(eq(content.authorId, actor.id), eq(content.status, "published"));
}

export const listInput = z
  .object({
    type: z.enum(["all", "post", "page"]).catch("all").default("all"),
    status: z.enum(["all", ...STATUSES]).catch("all").default("all"),
    author: z.string().max(200).optional().catch(undefined),
    category: z.string().max(64).optional().catch(undefined),
    q: z.string().max(200).optional().catch(undefined),
    page: z.coerce.number().int().min(1).catch(1).default(1),
  })
  .strip();
export type ListInput = z.infer<typeof listInput>;

export interface ListRow {
  id: string;
  type: ContentType;
  title: string;
  status: Status;
  authorName: string;
  authorId: string;
  publishAt: number | null;
  updatedAt: number;
  categories: string[];
  canEdit: boolean;
}

export async function listContent(actor: Actor, filters: ListInput) {
  await promoteDue();
  const base: (SQL | undefined)[] = [visibleTo(actor)];
  if (filters.type !== "all") base.push(eq(content.type, filters.type));
  if (filters.author) base.push(eq(content.authorId, filters.author));
  if (filters.category)
    base.push(
      sql`EXISTS (SELECT 1 FROM content_terms ct WHERE ct.content_id = ${content.id} AND ct.term_id = ${filters.category})`,
    );
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().replace(/[%_]/g, "")}%`;
    base.push(or(like(content.title, term), like(content.bodyText, term)));
  }
  const where = and(
    ...base,
    filters.status === "all" ? ne(content.status, "trash") : eq(content.status, filters.status),
  );
  const [statusCounts, [{ total }], rows] = await Promise.all([
    db.select({ status: content.status, n: count() }).from(content).where(and(...base)).groupBy(content.status),
    db.select({ total: count() }).from(content).where(where),
    db
      .select({
        id: content.id,
        type: content.type,
        title: content.title,
        status: content.status,
        authorId: content.authorId,
        authorName: users.displayName,
        publishAt: content.publishAt,
        updatedAt: content.updatedAt,
      })
      .from(content)
      .leftJoin(users, eq(users.id, content.authorId))
      .where(where)
      .orderBy(desc(content.updatedAt), desc(content.id))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
  ]);
  const cats = (await termsOf(rows.map((r) => r.id))).filter((t) => t.kind === "category");
  const counts: Record<string, number> = { all: 0 };
  for (const s of STATUSES) counts[s] = 0;
  for (const c of statusCounts) {
    counts[c.status] = c.n;
    if (c.status !== "trash") counts.all! += c.n;
  }
  const items: ListRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type as ContentType,
    title: r.title,
    status: r.status as Status,
    authorId: r.authorId,
    authorName: r.authorName ?? "Unknown",
    publishAt: r.publishAt,
    updatedAt: r.updatedAt,
    categories: cats.filter((c) => c.contentId === r.id).map((c) => c.name),
    canEdit: canEdit(actor, { type: r.type as ContentType, status: r.status as Status, authorId: r.authorId }),
  }));
  return { items, counts, total, page: filters.page, pageSize: PAGE_SIZE };
}

async function loadReadable(actor: Actor, id: string): Promise<Row> {
  await promoteDue();
  const [row] = await db.select().from(content).where(eq(content.id, id));
  if (!row || !canRead(actor, { type: row.type as ContentType, status: row.status as Status, authorId: row.authorId }))
    throw notFound("That item");
  return row;
}

export async function getContent(actor: Actor, id: string): Promise<ContentItem> {
  return toItem(await loadReadable(actor, id));
}

export async function getEditorData(actor: Actor, id: string) {
  const row = await loadReadable(actor, id);
  const item = toItem(row);
  const [itemTerms, revs] = await Promise.all([
    termsOf([id]),
    db
      .select({ id: revisions.id, title: revisions.title, createdAt: revisions.createdAt, authorName: users.displayName })
      .from(revisions)
      .leftJoin(users, eq(users.id, revisions.authorId))
      .where(eq(revisions.contentId, id))
      .orderBy(desc(revisions.createdAt), desc(revisions.id)),
  ]);
  return {
    item,
    categoryIds: itemTerms.filter((t) => t.kind === "category").map((t) => t.id),
    tags: itemTerms.filter((t) => t.kind === "tag").map((t) => t.name),
    revisions: revs.map((r) => ({ ...r, authorName: r.authorName ?? "Unknown" })),
    canEdit: canEdit(actor, { type: item.type, status: item.status, authorId: item.authorId }),
  };
}

export async function getRevision(actor: Actor, contentId: string, revisionId: string) {
  await loadReadable(actor, contentId);
  const [rev] = await db
    .select()
    .from(revisions)
    .where(and(eq(revisions.id, revisionId), eq(revisions.contentId, contentId)));
  if (!rev) throw notFound("That revision");
  return { id: rev.id, title: rev.title, excerpt: rev.excerpt, blocks: parseBlocks(rev.blocks), createdAt: rev.createdAt };
}

const fields = {
  title: z.string().trim().max(300),
  slug: z.string().trim().max(100),
  excerpt: z.string().trim().max(2_000),
  blocks: blocksSchema,
  status: z.enum(STATUSES),
  publishAt: z.union([z.number(), z.string().datetime({ offset: true }), z.null()]),
  parentId: z.string().max(64).nullable(),
  commentsOpen: z.boolean(),
  categories: z.array(z.string().max(64)).max(100),
  tags: z.array(z.string().max(100)).max(100),
};

export const createInput = z
  .object({
    type: z.enum(["post", "page"]),
    title: fields.title.default(""),
    slug: fields.slug.optional(),
    excerpt: fields.excerpt.default(""),
    blocks: fields.blocks.default([]),
    status: fields.status.default("draft"),
    publishAt: fields.publishAt.optional(),
    parentId: fields.parentId.optional(),
    commentsOpen: fields.commentsOpen.optional(),
    categories: fields.categories.default([]),
    tags: fields.tags.default([]),
  })
  .strict();

export const saveInput = z
  .object({
    title: fields.title.optional(),
    slug: fields.slug.optional(),
    excerpt: fields.excerpt.optional(),
    blocks: fields.blocks.optional(),
    status: fields.status.optional(),
    publishAt: fields.publishAt.optional(),
    parentId: fields.parentId.optional(),
    commentsOpen: fields.commentsOpen.optional(),
    categories: fields.categories.optional(),
    tags: fields.tags.optional(),
  })
  .strict();

async function uniqueSlug(type: ContentType, wanted: string, exceptId?: string): Promise<string> {
  const base = slugify(wanted);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [hit] = await db.select({ id: content.id }).from(content).where(and(eq(content.type, type), eq(content.slug, slug)));
    if (!hit || hit.id === exceptId) return slug;
  }
  throw new AppError(409, "Choose another slug.");
}

function toTime(value: number | string | null | undefined): number | null | undefined {
  if (value === undefined || value === null) return value;
  return typeof value === "number" ? value : Date.parse(value);
}

/** The stored status: publishing with a future date schedules it, a due schedule publishes. */
function settleStatus(status: Status, publishAt: number | null, now: number): { status: Status; publishAt: number | null } {
  if (status === "published" || status === "scheduled") {
    const at = publishAt ?? now;
    return { status: at > now ? "scheduled" : "published", publishAt: at };
  }
  return { status, publishAt };
}

async function checkParent(type: ContentType, parentId: string | null | undefined, selfId?: string) {
  if (!parentId || type !== "page") return null;
  let cursor: string | null = parentId;
  for (let i = 0; cursor && i < 50; i++) {
    if (cursor === selfId) throw invalid("A page can't sit under itself.");
    const [row] = await db.select({ type: content.type, parentId: content.parentId }).from(content).where(eq(content.id, cursor));
    if (row?.type !== "page") throw invalid("Choose an existing page as the parent.");
    cursor = row.parentId;
  }
  return parentId;
}

async function termStatements(id: string, type: ContentType, categories?: string[], tags?: string[]) {
  if (type !== "post" || (categories === undefined && tags === undefined)) return [];
  const current = await termsOf([id]);
  const categoryIds =
    categories !== undefined ? await existingCategoryIds(categories) : current.filter((t) => t.kind === "category").map((t) => t.id);
  const tagIds = tags !== undefined ? await tagIdsFor(tags) : current.filter((t) => t.kind === "tag").map((t) => t.id);
  const all = [...new Set([...(categoryIds.length ? categoryIds : [UNCATEGORIZED]), ...tagIds])];
  return [
    db.delete(contentTerms).where(eq(contentTerms.contentId, id)),
    db.insert(contentTerms).values(all.map((termId) => ({ contentId: id, termId }))),
  ];
}

export async function createContent(actor: Actor, input: z.infer<typeof createInput>): Promise<ContentItem> {
  if (!canCreate(actor, input.type)) throw forbidden();
  if (!canSetStatus(actor, input.status) || input.status === "trash") throw forbidden("Your role can't publish.");
  const now = Date.now();
  const id = crypto.randomUUID();
  const blocks = normalizeBlocks(input.blocks);
  const title = input.title;
  const slug = await uniqueSlug(input.type, input.slug || title || "untitled");
  const parentId = await checkParent(input.type, input.parentId);
  const { commentsDefaultOpen } = await getSettings();
  const settled = settleStatus(input.status, toTime(input.publishAt) ?? null, now);
  const blocksJson = JSON.stringify(blocks);
  const insert = db.insert(content).values({
    id,
    type: input.type,
    title,
    slug,
    excerpt: input.excerpt,
    blocks: blocksJson,
    bodyText: blocksText(blocks),
    status: settled.status,
    publishAt: settled.publishAt,
    authorId: actor.id,
    parentId,
    commentsOpen: input.commentsOpen ?? commentsDefaultOpen,
    createdAt: now,
    updatedAt: now,
  });
  const revision = db.insert(revisions).values({
    id: crypto.randomUUID(),
    contentId: id,
    title,
    excerpt: input.excerpt,
    blocks: blocksJson,
    authorId: actor.id,
    createdAt: now,
  });
  const termOps =
    input.type === "post" ? await termStatements(id, "post", input.categories, input.tags) : [];
  await db.batch([insert, revision, ...termOps]);
  return getContent(actor, id);
}

export async function saveContent(actor: Actor, id: string, input: z.infer<typeof saveInput>): Promise<ContentItem> {
  const row = await loadReadable(actor, id);
  const type = row.type as ContentType;
  const current = { type, status: row.status as Status, authorId: row.authorId };
  if (!canEdit(actor, current)) throw forbidden("You can't change this item.");
  const now = Date.now();
  let status = (input.status ?? row.status) as Status;
  if (input.status && input.status !== row.status && !canSetStatus(actor, input.status))
    throw forbidden("Your role can't publish.");
  // Restoring from the trash brings an item back as a draft.
  if (row.status === "trash" && input.status === undefined) status = "trash";
  const publishAtIn = toTime(input.publishAt);
  if (publishAtIn !== undefined && !canPublish(actor) && publishAtIn !== row.publishAt) throw forbidden("Your role can't schedule.");
  const settled = settleStatus(
    status,
    publishAtIn !== undefined ? publishAtIn : row.status === "published" || row.status === "scheduled" ? row.publishAt : null,
    now,
  );
  const title = input.title ?? row.title;
  const excerpt = input.excerpt ?? row.excerpt;
  const blocks = input.blocks ? normalizeBlocks(input.blocks) : parseBlocks(row.blocks);
  const blocksJson = JSON.stringify(blocks);
  const slug = input.slug !== undefined && input.slug !== row.slug ? await uniqueSlug(type, input.slug || title, id) : row.slug;
  const parentId = input.parentId !== undefined ? await checkParent(type, input.parentId, id) : row.parentId;
  const changed = title !== row.title || excerpt !== row.excerpt || blocksJson !== row.blocks;
  const ops = [
    db
      .update(content)
      .set({
        title,
        slug,
        excerpt,
        blocks: blocksJson,
        bodyText: blocksText(blocks),
        status: settled.status,
        publishAt: settled.publishAt,
        parentId,
        commentsOpen: input.commentsOpen ?? row.commentsOpen,
        updatedAt: now,
      })
      .where(eq(content.id, id)),
    ...(changed
      ? [
          db.insert(revisions).values({
            id: crypto.randomUUID(),
            contentId: id,
            title,
            excerpt,
            blocks: blocksJson,
            authorId: actor.id,
            createdAt: now,
          }),
        ]
      : []),
    ...(await termStatements(id, type, input.categories, input.tags)),
  ];
  await db.batch(ops as [(typeof ops)[0], ...typeof ops]);
  return getContent(actor, id);
}

export async function restoreRevision(actor: Actor, contentId: string, revisionId: string) {
  const rev = await getRevision(actor, contentId, revisionId);
  return saveContent(actor, contentId, { title: rev.title, excerpt: rev.excerpt, blocks: rev.blocks });
}

/** Permanently deletes an item that is in the trash. */
export async function deleteContent(actor: Actor, id: string): Promise<void> {
  const row = await loadReadable(actor, id);
  if (!canEdit(actor, { type: row.type as ContentType, status: row.status as Status, authorId: row.authorId }))
    throw forbidden("You can't delete this item.");
  if (row.status !== "trash") throw invalid("Move it to the trash first.");
  await db.batch([
    db.delete(revisions).where(eq(revisions.contentId, id)),
    db.delete(contentTerms).where(eq(contentTerms.contentId, id)),
    db.delete(comments).where(eq(comments.contentId, id)),
    db.update(content).set({ parentId: row.parentId }).where(eq(content.parentId, id)),
    db.update(settings).set({ frontPageId: null }).where(eq(settings.frontPageId, id)),
    db.delete(content).where(eq(content.id, id)),
  ]);
}

/** Pages a person can choose as a parent or front page. */
export async function listPages() {
  return db
    .select({ id: content.id, title: content.title, status: content.status })
    .from(content)
    .where(and(eq(content.type, "page"), ne(content.status, "trash")))
    .orderBy(asc(content.title));
}

/** Authors who wrote anything, for the list filter. */
export async function listAuthors() {
  return db
    .selectDistinct({ id: users.id, name: users.displayName })
    .from(users)
    .innerJoin(content, eq(content.authorId, users.id))
    .orderBy(asc(users.displayName));
}

export async function listCategoriesForFilter() {
  return db.select({ id: terms.id, name: terms.name }).from(terms).where(eq(terms.kind, "category")).orderBy(asc(terms.name));
}

