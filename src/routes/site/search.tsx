import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PostList, SiteLayout } from "@/client/components/SiteLayout";
import { getSearch } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/search")({
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? "", page: search.page ?? 1 }),
  loader: ({ deps }) => getSearch({ data: deps }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Search · ${loaderData.site.title}` }] : [] }),
  component: SearchPage,
});

function SearchPage() {
  const data = Route.useLoaderData();
  const r = data.results;
  return (
    <SiteLayout chrome={data} q={r.q}>
      <h1 className="text-3xl font-semibold tracking-tight">{r.q ? `Results for “${r.q}”` : "Search"}</h1>
      {r.q ? (
        <PostList
          posts={r.posts}
          page={r.page}
          pages={r.pages}
          base={`/site/search?q=${encodeURIComponent(r.q)}`}
          empty="Nothing matches. Try other words."
        />
      ) : null}
    </SiteLayout>
  );
}
