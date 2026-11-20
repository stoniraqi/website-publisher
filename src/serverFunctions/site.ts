// The public site's data. Called from /site loaders during server rendering;
// every function returns published content only and no email addresses.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as site from "@/server/site";

const pageNo = z.coerce.number().int().min(1).max(10_000).catch(1).default(1);
const slugInput = z.object({ slug: z.string().max(120), page: pageNo }).strip();

export const getHome = createServerFn()
  .validator((data: unknown) => z.object({ page: pageNo }).strip().parse(data ?? {}))
  .handler(async ({ data }) => ({ site: await site.siteInfo(), nav: await site.navPages(), home: await site.homePage(data.page) }));

export const getPost = createServerFn()
  .validator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }) => ({ site: await site.siteInfo(), nav: await site.navPages(), post: await site.singlePost(data.slug) }));

export const getPage = createServerFn()
  .validator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }) => ({ site: await site.siteInfo(), nav: await site.navPages(), page: await site.singlePage(data.slug) }));

export const getTermArchive = createServerFn()
  .validator((data: unknown) => slugInput.extend({ kind: z.enum(["category", "tag"]) }).parse(data))
  .handler(async ({ data }) => ({
    site: await site.siteInfo(),
    nav: await site.navPages(),
    archive: await site.termArchive(data.kind, data.slug, data.page),
  }));

export const getAuthorArchive = createServerFn()
  .validator((data: unknown) => z.object({ id: z.string().max(200), page: pageNo }).strip().parse(data))
  .handler(async ({ data }) => ({
    site: await site.siteInfo(),
    nav: await site.navPages(),
    archive: await site.authorArchive(data.id, data.page),
  }));

export const getSearch = createServerFn()
  .validator((data: unknown) => z.object({ q: z.string().max(200).catch(""), page: pageNo }).strip().parse(data ?? {}))
  .handler(async ({ data }) => ({ site: await site.siteInfo(), nav: await site.navPages(), results: await site.search(data.q, data.page) }));
