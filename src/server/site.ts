// What anyone may read: published content only, and never an email address.
import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { content, users } from "@/db/schema";
import { parseBlocks } from "@/server/blocks";
import { approvedCounts, publicComments } from "@/server/comments";
import { promoteDue } from "@/server/content";
import { getSettings } from "@/server/settings";
import { termBySlug, termsOf } from "@/server/terms";

export async function siteInfo() {
  const s = await getSettings();
  return { title: s.siteTitle, tagline: s.tagline };
}

const published = (type: "post" | "page") => and(eq(content.type, type), eq(content.status, "published"));

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishAt: number;
  authorId: string;
  authorName: string;
  comments: number;
}

async function summaries(where: SQL | undefined, page: number) {
  await promoteDue();
  const { postsPerPage } = await getSettings();
  const filter = and(published("post"), where);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(content).where(filter),
    db
      .select({
        id: content.id,
        title: content.title,
        slug: content.slug,
        excerpt: content.excerpt,
        bodyText: content.bodyText,
        publishAt: content.publishAt,
        createdAt: content.createdAt,
        authorId: content.authorId,
        authorName: users.displayName,
      })
      .from(content)
      .leftJoin(users, eq(users.id, content.authorId))
      .where(filter)
      .orderBy(desc(content.publishAt), desc(content.id))
      .limit(postsPerPage)
      .offset((Math.max(1, page) - 1) * postsPerPage),
  ]);
  const counts = await approvedCounts(rows.map((r) => r.id));
  const posts: PostSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt || shorten(r.bodyText),
    publishAt: r.publishAt ?? r.createdAt,
    authorId: r.authorId,
    authorName: r.authorName ?? "",
    comments: counts.get(r.id) ?? 0,
  }));
  return { posts, page, pages: Math.max(1, Math.ceil(total / postsPerPage)) };
}

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 240 ? `${flat.slice(0, 240).replace(/\s\S*$/, "")}…` : flat;
}

export async function homePage(page: number) {
  const settings = await getSettings();
  if (settings.frontPageId && page === 1) {
    await promoteDue();
    const [front] = await db
      .select({ slug: content.slug })
      .from(content)
      .where(and(eq(content.id, settings.frontPageId), published("page")));
    if (front) {
      const single = await singlePage(front.slug);
      if (single) return { kind: "page" as const, page: single };
    }
  }
  return { kind: "posts" as const, ...(await summaries(undefined, page)) };
}

async function byline(authorId: string) {
  const [u] = await db.select({ name: users.displayName, bio: users.bio }).from(users).where(eq(users.id, authorId));
  return { id: authorId, name: u?.name ?? "", bio: u?.bio ?? "" };
}

export async function singlePost(slug: string) {
  await promoteDue();
  const [row] = await db.select().from(content).where(and(published("post"), eq(content.slug, slug)));
  if (!row) return null;
  const [author, itemTerms, comments] = await Promise.all([byline(row.authorId), termsOf([row.id]), publicComments(row.id)]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    blocks: parseBlocks(row.blocks),
    publishAt: row.publishAt ?? row.createdAt,
    commentsOpen: row.commentsOpen,
    author,
    categories: itemTerms.filter((t) => t.kind === "category").map(({ name, slug }) => ({ name, slug })),
    tags: itemTerms.filter((t) => t.kind === "tag").map(({ name, slug }) => ({ name, slug })),
    comments,
  };
}

export async function singlePage(slug: string) {
  await promoteDue();
  const [row] = await db.select().from(content).where(and(published("page"), eq(content.slug, slug)));
  if (!row) return null;
  let parent: { title: string; slug: string } | null = null;
  if (row.parentId) {
    const [p] = await db
      .select({ title: content.title, slug: content.slug })
      .from(content)
      .where(and(eq(content.id, row.parentId), published("page")));
    parent = p ?? null;
  }
  const children = await db
    .select({ title: content.title, slug: content.slug })
    .from(content)
    .where(and(eq(content.parentId, row.id), published("page")))
    .orderBy(content.title);
  return { id: row.id, title: row.title, slug: row.slug, blocks: parseBlocks(row.blocks), parent, children };
}

export async function termArchive(kind: "category" | "tag", slug: string, page: number) {
  const term = await termBySlug(kind, slug);
  if (!term) return null;
  const list = await summaries(
    sql`EXISTS (SELECT 1 FROM content_terms ct WHERE ct.content_id = ${content.id} AND ct.term_id = ${term.id})`,
    page,
  );
  return { name: term.name, slug: term.slug, ...list };
}

export async function authorArchive(id: string, page: number) {
  const [u] = await db.select({ id: users.id, name: users.displayName, bio: users.bio }).from(users).where(eq(users.id, id));
  if (!u) return null;
  return { author: u, ...(await summaries(eq(content.authorId, id), page)) };
}

export async function search(q: string, page: number) {
  const words = q.trim().replace(/[%_]/g, "").slice(0, 100);
  if (!words) return { q: "", posts: [], page: 1, pages: 1 };
  const term = `%${words}%`;
  return { q: words, ...(await summaries(or(like(content.title, term), like(content.bodyText, term)), page)) };
}

export async function navPages() {
  return db
    .select({ title: content.title, slug: content.slug })
    .from(content)
    .where(and(published("page"), sql`${content.parentId} IS NULL`))
    .orderBy(content.title)
    .limit(8);
}

export async function feedItems() {
  await promoteDue();
  return db
    .select({
      title: content.title,
      slug: content.slug,
      excerpt: content.excerpt,
      bodyText: content.bodyText,
      publishAt: content.publishAt,
      authorName: users.displayName,
    })
    .from(content)
    .leftJoin(users, eq(users.id, content.authorId))
    .where(published("post"))
    .orderBy(desc(content.publishAt))
    .limit(20);
}

export { shorten };
