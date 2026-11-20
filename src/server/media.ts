import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { content, media, users } from "@/db/schema";
import { promoteDue } from "@/server/content";
import { AppError, forbidden, invalid, notFound } from "@/server/errors";
import { type Actor, canDeleteMedia, canUpload, canWrite } from "@/server/permissions";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf", "text/plain"]);

export interface MediaItem {
  id: string;
  filename: string;
  mime: string;
  size: number;
  title: string;
  alt: string;
  caption: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: number;
  canChange: boolean;
}

export async function listMedia(actor: Actor): Promise<MediaItem[]> {
  if (!canWrite(actor)) throw forbidden();
  const rows = await db
    .select({ m: media, uploaderName: users.displayName })
    .from(media)
    .leftJoin(users, eq(users.id, media.uploaderId))
    .orderBy(desc(media.createdAt), desc(media.id));
  return rows.map(({ m, uploaderName }) => ({
    id: m.id,
    filename: m.filename,
    mime: m.mime,
    size: m.size,
    title: m.title,
    alt: m.alt,
    caption: m.caption,
    uploaderId: m.uploaderId,
    uploaderName: uploaderName ?? "Unknown",
    createdAt: m.createdAt,
    canChange: canDeleteMedia(actor, m.uploaderId),
  }));
}

export async function uploadMedia(actor: Actor, file: File): Promise<{ id: string; filename: string }> {
  if (!canUpload(actor)) throw forbidden("Your role can't upload files.");
  if (file.size === 0) throw invalid("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "Files can be up to 10 MB.");
  const id = crypto.randomUUID();
  const filename = (file.name || "file").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200);
  const mime = (file.type || "application/octet-stream").slice(0, 100);
  const key = `media/${id}`;
  await env.media.put(key, file.stream(), { httpMetadata: { contentType: mime } });
  try {
    await db.insert(media).values({
      id,
      r2Key: key,
      filename,
      mime,
      size: file.size,
      title: filename.replace(/\.[^.]+$/, ""),
      uploaderId: actor.id,
      createdAt: Date.now(),
    });
  } catch (error) {
    await env.media.delete(key);
    throw error;
  }
  return { id, filename };
}

export const updateMediaInput = z
  .object({
    id: z.string().max(64),
    title: z.string().trim().max(200),
    alt: z.string().trim().max(500),
    caption: z.string().trim().max(1_000),
  })
  .strict();

async function loadOwned(actor: Actor, id: string) {
  if (!canWrite(actor)) throw notFound("That file");
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) throw notFound("That file");
  if (!canDeleteMedia(actor, row.uploaderId)) throw forbidden("You can only change files you uploaded.");
  return row;
}

export async function updateMedia(actor: Actor, input: z.infer<typeof updateMediaInput>) {
  await loadOwned(actor, input.id);
  await db.update(media).set({ title: input.title, alt: input.alt, caption: input.caption }).where(eq(media.id, input.id));
}

export async function deleteMedia(actor: Actor, id: string) {
  const row = await loadOwned(actor, id);
  await env.media.delete(row.r2Key);
  await db.delete(media).where(eq(media.id, id));
}

function fileResponse(object: R2ObjectBody, mime: string, filename: string, cache: string) {
  const inline = INLINE_TYPES.has(mime);
  return new Response(object.body, {
    headers: {
      "content-type": inline ? mime : "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/["\\]/g, "_")}"`,
      "content-length": String(object.size),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": cache,
    },
  });
}

/** The file for a signed-in writer. */
export async function memberFile(actor: Actor, id: string): Promise<Response> {
  if (!canWrite(actor)) throw notFound("That file");
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) throw notFound("That file");
  const object = await env.media.get(row.r2Key);
  if (!object) throw notFound("That file");
  return fileResponse(object, row.mime, row.filename, "private, max-age=300");
}

/** The file for anyone, only while published content uses it. */
export async function publicFile(id: string): Promise<Response | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) return null;
  await promoteDue();
  const [used] = await db
    .select({ id: content.id })
    .from(content)
    .where(and(eq(content.status, "published"), like(content.blocks, `%"mediaId":"${id}"%`)))
    .limit(1);
  if (!used) return null;
  const object = await env.media.get(row.r2Key);
  if (!object) return null;
  return fileResponse(object, row.mime, row.filename, "public, max-age=300");
}
