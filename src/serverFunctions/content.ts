import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as content from "@/server/content";
import { ROLE_LABELS, canCreate, canManageTerms, canUpload, canWrite, isAdministrator } from "@/server/permissions";
import { listTerms } from "@/server/terms";
import { listMedia } from "@/server/media";
import { getSettings } from "@/server/settings";
import { personMiddleware } from "./middleware";

const idInput = z.object({ id: z.string().min(1).max(64) }).strict();

/** Who the person is here, for the navigation. */
export const getMe = createServerFn()
  .middleware([personMiddleware])
  .handler(({ context: { person } }) => ({
    id: person.id,
    displayName: person.displayName,
    role: person.role,
    roleLabel: ROLE_LABELS[person.role],
    isAdmin: isAdministrator(person),
    canWrite: canWrite(person),
    canCreatePages: canCreate(person, "page"),
    canUpload: canUpload(person),
    canManageTerms: canManageTerms(person),
  }));

export const getContentList = createServerFn()
  .middleware([personMiddleware])
  .validator((data: unknown) => content.listInput.parse(data ?? {}))
  .handler(async ({ data, context: { person } }) => {
    const [list, authors, categories] = await Promise.all([
      content.listContent(person, data),
      content.listAuthors(),
      content.listCategoriesForFilter(),
    ]);
    return { ...list, authors, categories };
  });

export const getEditor = createServerFn()
  .middleware([personMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().max(64), type: z.enum(["post", "page"]).optional() }).parse(data))
  .handler(async ({ data, context: { person } }) => {
    const [settings, categories, pages, library] = await Promise.all([
      getSettings(),
      listTerms("category"),
      content.listPages(),
      canWrite(person) ? listMedia(person) : Promise.resolve([]),
    ]);
    const shared = {
      categories,
      pages,
      library: library.filter((m) => m.mime.startsWith("image/")),
      canPublish: canUpload(person),
      commentsDefaultOpen: settings.commentsDefaultOpen,
    };
    if (data.id === "new") {
      const type = data.type ?? "post";
      return { ...shared, editor: null, newType: type, canCreate: canCreate(person, type) };
    }
    return { ...shared, editor: await content.getEditorData(person, data.id), newType: null, canCreate: false };
  });

export const createContent = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => content.createInput.parse(data))
  .handler(({ data, context: { person } }) => content.createContent(person, data));

export const saveContent = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().max(64), changes: content.saveInput }).strict().parse(data))
  .handler(({ data, context: { person } }) => content.saveContent(person, data.id, data.changes));

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { person } }) => content.deleteContent(person, data.id));

const revisionInput = z.object({ id: z.string().max(64), revisionId: z.string().max(64) }).strict();

export const getRevision = createServerFn()
  .middleware([personMiddleware])
  .validator((data: unknown) => revisionInput.parse(data))
  .handler(({ data, context: { person } }) => content.getRevision(person, data.id, data.revisionId));

export const restoreRevision = createServerFn({ method: "POST" })
  .middleware([personMiddleware])
  .validator((data: unknown) => revisionInput.parse(data))
  .handler(({ data, context: { person } }) => content.restoreRevision(person, data.id, data.revisionId));
