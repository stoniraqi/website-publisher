import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, content } from "@/db/schema";
import { promoteDue } from "@/server/content";
import { forbidden, invalid, notFound } from "@/server/errors";
import { type Actor, canModerate, canModerateAll, canPublish, type CommentStatus } from "@/server/permissions";
import type { Person } from "@/server/users";

export { COMMENT_STATUSES } from "@/server/permissions";

export const visitorCommentInput = z.object({
  postId: z.string().min(1).max(64),
  parentId: z.string().max(64).optional().transform((v) => v || undefined),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  body: z.string().trim().min(1).max(5_000),
});

export type CommentOutcome = "pending" | "approved" | "closed" | "invalid";

/** A visitor's comment on a public post. */
export async function addVisitorComment(raw: unknown): Promise<{ outcome: CommentOutcome; slug: string | null }> {
  const parsed = visitorCommentInput.safeParse(raw);
  const postId = typeof (raw as { postId?: unknown })?.postId === "string" ? (raw as { postId: string }).postId : "";
  await promoteDue();
  const [post] = postId
    ? await db
        .select({ id: content.id, slug: content.slug, status: content.status, commentsOpen: content.commentsOpen, type: content.type })
        .from(content)
        .where(eq(content.id, postId))
    : [];
  const slug = post && post.status === "published" && post.type === "post" ? post.slug : null;
  if (!slug || !post?.commentsOpen) return { outcome: "closed", slug };
  if (!parsed.success) return { outcome: "invalid", slug };
  const input = parsed.data;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.contentId, post.id), eq(comments.status, "approved")));
    if (!parent) return { outcome: "invalid", slug };
  }
  const [known] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.authorEmail, input.email), eq(comments.status, "approved")))
    .limit(1);
  const status: CommentStatus = known ? "approved" : "pending";
  await db.insert(comments).values({
    id: crypto.randomUUID(),
    contentId: post.id,
    parentId: input.parentId ?? null,
    authorName: input.name,
    authorEmail: input.email,
    body: input.body,
    status,
    userId: null,
    createdAt: Date.now(),
  });
  return { outcome: status, slug };
}

/** Comments the person moderates: all for editors, their own posts' for authors. */
function scope(actor: Actor) {
  if (canModerateAll(actor)) return undefined;
  if (canPublish(actor)) return eq(content.authorId, actor.id);
  return sql`0`;
}

export async function listComments(actor: Actor, status: CommentStatus) {
  const where = scope(actor);
  const [counts, rows] = await Promise.all([
    db
      .select({ status: comments.status, n: count() })
      .from(comments)
      .innerJoin(content, eq(content.id, comments.contentId))
      .where(where)
      .groupBy(comments.status),
    db
      .select({
        id: comments.id,
        authorName: comments.authorName,
        authorEmail: comments.authorEmail,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        parentId: comments.parentId,
        postId: content.id,
        postTitle: content.title,
        postSlug: content.slug,
      })
      .from(comments)
      .innerJoin(content, eq(content.id, comments.contentId))
      .where(and(where, eq(comments.status, status)))
      .orderBy(desc(comments.createdAt))
      .limit(200),
  ]);
  const byStatus: Record<CommentStatus, number> = { pending: 0, approved: 0, spam: 0, trash: 0 };
  for (const c of counts) if (c.status in byStatus) byStatus[c.status as CommentStatus] = c.n;
  return { counts: byStatus, items: rows, canModerate: canPublish(actor) };
}

async function loadModeratable(actor: Actor, id: string) {
  const [row] = await db
    .select({ id: comments.id, status: comments.status, contentId: comments.contentId, postAuthor: content.authorId })
    .from(comments)
    .innerJoin(content, eq(content.id, comments.contentId))
    .where(eq(comments.id, id));
  if (!row) throw notFound("That comment");
  if (!canModerate(actor, row.postAuthor)) throw forbidden();
  return row;
}

export const moderateInput = z
  .object({ id: z.string().max(64), action: z.enum(["approve", "unapprove", "spam", "trash", "restore"]) })
  .strict();

const NEXT: Record<z.infer<typeof moderateInput>["action"], CommentStatus> = {
  approve: "approved",
  unapprove: "pending",
  spam: "spam",
  trash: "trash",
  restore: "pending",
};

export async function moderateComment(actor: Actor, input: z.infer<typeof moderateInput>) {
  await loadModeratable(actor, input.id);
  await db.update(comments).set({ status: NEXT[input.action] }).where(eq(comments.id, input.id));
}

export async function deleteComment(actor: Actor, id: string) {
  const row = await loadModeratable(actor, id);
  if (row.status !== "trash" && row.status !== "spam") throw invalid("Move it to the trash first.");
  // Replies stay, moved up a level.
  const [self] = await db.select({ parentId: comments.parentId }).from(comments).where(eq(comments.id, id));
  await db.batch([
    db.update(comments).set({ parentId: self?.parentId ?? null }).where(eq(comments.parentId, id)),
    db.delete(comments).where(eq(comments.id, id)),
  ]);
}

export const replyInput = z.object({ id: z.string().max(64), body: z.string().trim().min(1, "Write a reply.").max(5_000) }).strict();

export async function replyToComment(person: Person, input: z.infer<typeof replyInput>) {
  const row = await loadModeratable(person, input.id);
  await db.batch([
    // Replying to a held comment approves it.
    db.update(comments).set({ status: "approved" }).where(and(eq(comments.id, row.id), eq(comments.status, "pending"))),
    db.insert(comments).values({
      id: crypto.randomUUID(),
      contentId: row.contentId,
      parentId: row.id,
      authorName: person.displayName,
      authorEmail: person.email,
      body: input.body,
      status: "approved",
      userId: person.id,
      createdAt: Date.now(),
    }),
  ]);
}

/** Approved comments on a post, without email addresses. */
export async function publicComments(contentId: string) {
  return db
    .select({ id: comments.id, parentId: comments.parentId, authorName: comments.authorName, body: comments.body, createdAt: comments.createdAt })
    .from(comments)
    .where(and(eq(comments.contentId, contentId), eq(comments.status, "approved")))
    .orderBy(comments.createdAt);
}

export async function approvedCounts(contentIds: string[]) {
  if (contentIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ id: comments.contentId, n: count() })
    .from(comments)
    .where(and(inArray(comments.contentId, contentIds), eq(comments.status, "approved")))
    .groupBy(comments.contentId);
  return new Map(rows.map((r) => [r.id, r.n]));
}
