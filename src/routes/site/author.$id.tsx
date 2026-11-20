import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { PostList, SiteLayout, SiteNotFound } from "@/client/components/SiteLayout";
import { getAuthorArchive } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/author/$id")({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps }) => {
    const data = await getAuthorArchive({ data: { id: params.id, page: deps.page } });
    if (!data.archive) throw notFound();
    return { ...data, archive: data.archive };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.archive.author.name} · ${loaderData.site.title}` }] : [],
  }),
  component: AuthorArchive,
  notFoundComponent: SiteNotFound,
});

function AuthorArchive() {
  const data = Route.useLoaderData();
  const a = data.archive;
  return (
    <SiteLayout chrome={data}>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{a.author.name}</h1>
        {a.author.bio ? <p className="text-muted-foreground">{a.author.bio}</p> : null}
      </header>
      <PostList
        posts={a.posts}
        page={a.page}
        pages={a.pages}
        base={`/site/author/${encodeURIComponent(a.author.id)}`}
        empty="No posts yet."
      />
    </SiteLayout>
  );
}
