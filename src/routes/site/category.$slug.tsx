import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { PostList, SiteLayout, SiteNotFound } from "@/client/components/SiteLayout";
import { getTermArchive } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/category/$slug")({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps }) => {
    const data = await getTermArchive({ data: { kind: "category", slug: params.slug, page: deps.page } });
    if (!data.archive) throw notFound();
    return { ...data, archive: data.archive };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.archive.name} · ${loaderData.site.title}` }] : [],
  }),
  component: Archive,
  notFoundComponent: SiteNotFound,
});

function Archive() {
  const data = Route.useLoaderData();
  const a = data.archive;
  return (
    <SiteLayout chrome={data}>
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Category</p>
        <h1 className="text-3xl font-semibold tracking-tight">{a.name}</h1>
      </header>
      <PostList posts={a.posts} page={a.page} pages={a.pages} base={`/site/category/${a.slug}`} empty="No posts here yet." />
    </SiteLayout>
  );
}
