import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { content, settings } from "@/db/schema";
import { invalid } from "@/server/errors";
import { ASSIGNABLE_ROLES } from "@/server/permissions";

export interface SiteSettings {
  siteTitle: string;
  tagline: string;
  postsPerPage: number;
  defaultRole: (typeof ASSIGNABLE_ROLES)[number];
  commentsDefaultOpen: boolean;
  frontPageId: string | null;
}

const DEFAULTS: SiteSettings = {
  siteTitle: "My Website",
  tagline: "",
  postsPerPage: 10,
  defaultRole: "contributor",
  commentsDefaultOpen: true,
  frontPageId: null,
};

export async function getSettings(): Promise<SiteSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!row) return DEFAULTS;
  return {
    siteTitle: row.siteTitle,
    tagline: row.tagline,
    postsPerPage: row.postsPerPage,
    defaultRole: (ASSIGNABLE_ROLES as readonly string[]).includes(row.defaultRole)
      ? (row.defaultRole as SiteSettings["defaultRole"])
      : DEFAULTS.defaultRole,
    commentsDefaultOpen: row.commentsDefaultOpen,
    frontPageId: row.frontPageId,
  };
}

export const settingsInput = z
  .object({
    siteTitle: z.string().trim().min(1, "Give the site a title.").max(120),
    tagline: z.string().trim().max(200),
    postsPerPage: z.coerce.number().int().min(1, "Show at least one post per page.").max(50),
    defaultRole: z.enum(ASSIGNABLE_ROLES),
    commentsDefaultOpen: z.boolean(),
    frontPageId: z.string().max(64).nullable(),
  })
  .strict();

/** Callers check the person is an administrator first. */
export async function saveSettings(input: z.infer<typeof settingsInput>): Promise<SiteSettings> {
  if (input.frontPageId) {
    const [page] = await db.select({ type: content.type }).from(content).where(eq(content.id, input.frontPageId));
    if (page?.type !== "page") throw invalid("Choose one of the site's pages.");
  }
  await db
    .insert(settings)
    .values({ id: 1, ...input })
    .onConflictDoUpdate({ target: settings.id, set: input });
  return getSettings();
}
