import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as comments from "@/server/comments";
import * as media from "@/server/media";
import * as settings from "@/server/settings";
import * as terms from "@/server/terms";
import * as users from "@/server/users";
import { listPages } from "@/server/content";
import { canManageTerms, canUpload, isAdministrator } from "@/server/permissions";
import { forbidden } from "@/server/errors";
import { personMiddleware } from "./middleware";

const idInput = z.object({ id: z.string().min(1).max(64) }).strict();

// Media
export const getMedia = createServerFn()
  .middleware([personMiddleware])
  .handler(async ({ context: { person } }) => ({
    items: person.role === "subscriber" ? [] : await media.listMedia(person),
    canUpload: canUpload(person),
    maxBytes: media.MAX_UPLOAD_BYTES,
  }));

export const updateMedia = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => media.updateMediaInput.parse(data))
  .handler(({ data, context: { person } }) => media.updateMedia(person, data));

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { person } }) => media.deleteMedia(person, data.id));

// Categories and tags
export const getTerms = createServerFn()
  .middleware([personMiddleware])
  .handler(async ({ context: { person } }) => {
    const all = await terms.listTerms();
    return {
      categories: terms.categoryTree(all.filter((t) => t.kind === "category")),
      tags: all.filter((t) => t.kind === "tag"),
      canManage: canManageTerms(person),
    };
  });

export const createTerm = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => terms.createTermInput.parse(data))
  .handler(({ data, context: { person } }) => terms.createTerm(person, data));

export const updateTerm = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => terms.updateTermInput.parse(data))
  .handler(({ data, context: { person } }) => terms.updateTerm(person, data));

export const deleteTerm = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { person } }) => terms.deleteTerm(person, data.id));

// Comments
export const getComments = createServerFn()
  .middleware([personMiddleware])
  .validator((data: unknown) =>
    z.object({ status: z.enum(comments.COMMENT_STATUSES).catch("pending").default("pending") }).parse(data ?? {}),
  )
  .handler(({ data, context: { person } }) => comments.listComments(person, data.status));

export const moderateComment = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => comments.moderateInput.parse(data))
  .handler(({ data, context: { person } }) => comments.moderateComment(person, data));

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { person } }) => comments.deleteComment(person, data.id));

export const replyToComment = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => comments.replyInput.parse(data))
  .handler(({ data, context: { person } }) => comments.replyToComment(person, data));

// People and profile
export const getPeople = createServerFn()
  .middleware([personMiddleware])
  .handler(async ({ context: { person } }) =>
    isAdministrator(person) ? { allowed: true as const, people: await users.listPeople(person) } : { allowed: false as const, people: [] },
  );

export const setRole = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => users.setRoleInput.parse(data))
  .handler(({ data, context: { person } }) => users.setRole(person, data));

export const getProfile = createServerFn()
  .middleware([personMiddleware])
  .handler(({ context: { person } }) => ({
    id: person.id,
    email: person.email,
    displayName: person.displayName,
    bio: person.bio,
    role: person.role,
  }));

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => users.profileInput.parse(data))
  .handler(({ data, context: { person } }) => users.updateProfile(person, data));

// Site settings
export const getSiteSettings = createServerFn()
  .middleware([personMiddleware])
  .handler(async ({ context: { person } }) =>
    isAdministrator(person)
      ? { allowed: true as const, settings: await settings.getSettings(), pages: await listPages() }
      : { allowed: false as const, settings: null, pages: [] },
  );

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => settings.settingsInput.parse(data))
  .handler(({ data, context: { person } }) => {
    if (!isAdministrator(person)) throw forbidden();
    return settings.saveSettings(data);
  });
