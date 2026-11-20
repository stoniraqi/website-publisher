import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { contentTerms, terms } from "@/db/schema";
import { slugify } from "@/server/blocks";
import { AppError, forbidden, invalid, notFound } from "@/server/errors";
import { type Actor, canManageTerms } from "@/server/permissions";

export const UNCATEGORIZED = "uncategorized";
export type TermKind = "category" | "tag";

export interface Term {
  id: string;
  kind: TermKind;
  name: string;
  slug: string;
  parentId: string | null;
  count: number;
}

export async function listTerms(kind?: TermKind): Promise<Term[]> {
  const rows = await db
    .select({
      id: terms.id,
      kind: terms.kind,
      name: terms.name,
      slug: terms.slug,
      parentId: terms.parentId,
      count: count(contentTerms.contentId),
    })
    .from(terms)
    .leftJoin(contentTerms, eq(contentTerms.termId, terms.id))
    .where(kind ? eq(terms.kind, kind) : undefined)
    .groupBy(terms.id)
    .orderBy(asc(terms.name));
  return rows as Term[];
}

/** Categories in tree order, each with its depth. */
export function categoryTree(categories: Term[]): (Term & { depth: number })[] {
  const out: (Term & { depth: number })[] = [];
  const ids = new Set(categories.map((c) => c.id));
  const walk = (parent: string | null, depth: number) => {
    for (const c of categories) {
      const p = c.parentId && ids.has(c.parentId) ? c.parentId : null;
      if (p === parent && depth < 20) {
        out.push({ ...c, depth });
        walk(c.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return out;
}

async function uniqueSlug(kind: TermKind, wanted: string, exceptId?: string): Promise<string> {
  const base = slugify(wanted);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [hit] = await db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, kind), eq(terms.slug, slug)));
    if (!hit || hit.id === exceptId) return slug;
  }
  throw new AppError(409, "Choose another slug.");
}

export const createTermInput = z
  .object({
    kind: z.enum(["category", "tag"]),
    name: z.string().trim().min(1, "Enter a name.").max(100),
    slug: z.string().trim().max(100).optional(),
    parentId: z.string().max(64).nullable().optional(),
  })
  .strict();

async function checkParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return null;
  const [parent] = await db.select().from(terms).where(eq(terms.id, parentId));
  if (parent?.kind !== "category") throw invalid("Choose an existing category as the parent.");
  // No loops: the parent can't sit under this category.
  let cursor: string | null = parent.id;
  for (let i = 0; cursor && i < 50; i++) {
    if (cursor === selfId) throw invalid("A category can't sit under itself.");
    const [row] = await db.select({ parentId: terms.parentId }).from(terms).where(eq(terms.id, cursor));
    cursor = row?.parentId ?? null;
  }
  return parent.id;
}

export async function createTerm(actor: Actor, input: z.infer<typeof createTermInput>): Promise<Term> {
  if (!canManageTerms(actor)) throw forbidden();
  const parentId = input.kind === "category" ? await checkParent(input.parentId) : null;
  const slug = await uniqueSlug(input.kind, input.slug || input.name);
  const id = crypto.randomUUID();
  await db.insert(terms).values({ id, kind: input.kind, name: input.name, slug, parentId });
  return { id, kind: input.kind, name: input.name, slug, parentId, count: 0 };
}

export const updateTermInput = z
  .object({
    id: z.string().max(64),
    name: z.string().trim().min(1, "Enter a name.").max(100),
    slug: z.string().trim().max(100).optional(),
    parentId: z.string().max(64).nullable().optional(),
  })
  .strict();

export async function updateTerm(actor: Actor, input: z.infer<typeof updateTermInput>): Promise<void> {
  if (!canManageTerms(actor)) throw forbidden();
  const [term] = await db.select().from(terms).where(eq(terms.id, input.id));
  if (!term) throw notFound("That term");
  const kind = term.kind as TermKind;
  const parentId =
    kind === "category" && input.parentId !== undefined ? await checkParent(input.parentId, term.id) : term.parentId;
  const slug = input.slug ? await uniqueSlug(kind, input.slug, term.id) : term.slug;
  await db.update(terms).set({ name: input.name, slug, parentId }).where(eq(terms.id, term.id));
}

export async function deleteTerm(actor: Actor, id: string): Promise<void> {
  if (!canManageTerms(actor)) throw forbidden();
  if (id === UNCATEGORIZED) throw forbidden("The default category can't be deleted.");
  const [term] = await db.select().from(terms).where(eq(terms.id, id));
  if (!term) throw notFound("That term");
  await db.batch([
    db.update(terms).set({ parentId: term.parentId }).where(eq(terms.parentId, id)),
    db.delete(contentTerms).where(eq(contentTerms.termId, id)),
    db.delete(terms).where(eq(terms.id, id)),
    // Posts left without a category go back to the default one.
    db.run(sql`INSERT OR IGNORE INTO content_terms (content_id, term_id)
      SELECT c.id, ${UNCATEGORIZED} FROM content c WHERE c.type = 'post'
      AND NOT EXISTS (SELECT 1 FROM content_terms ct JOIN terms t ON t.id = ct.term_id
        WHERE ct.content_id = c.id AND t.kind = 'category')`),
  ]);
}

/** The ids for the given tag names, creating the ones that don't exist. */
export async function tagIdsFor(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 100);
    if (!name) continue;
    const slug = slugify(name);
    const [hit] = await db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, "tag"), eq(terms.slug, slug)));
    if (hit) {
      ids.push(hit.id);
      continue;
    }
    const id = crypto.randomUUID();
    await db.insert(terms).values({ id, kind: "tag", name, slug, parentId: null }).onConflictDoNothing();
    const [row] = await db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, "tag"), eq(terms.slug, slug)));
    if (row) ids.push(row.id);
  }
  return [...new Set(ids)];
}

/** Only ids of existing categories. */
export async function existingCategoryIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: terms.id }).from(terms).where(and(eq(terms.kind, "category"), inArray(terms.id, ids)));
  return rows.map((r) => r.id);
}

export async function termsOf(contentIds: string[]) {
  if (contentIds.length === 0) return [];
  return db
    .select({ contentId: contentTerms.contentId, id: terms.id, kind: terms.kind, name: terms.name, slug: terms.slug })
    .from(contentTerms)
    .innerJoin(terms, eq(terms.id, contentTerms.termId))
    .where(inArray(contentTerms.contentId, contentIds))
    .orderBy(asc(terms.name));
}

export async function termBySlug(kind: TermKind, slug: string) {
  const [row] = await db.select().from(terms).where(and(eq(terms.kind, kind), eq(terms.slug, slug)));
  return row ?? null;
}

