import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Blocks } from "@/client/components/Blocks";
import { PostList, SiteLayout } from "@/client/components/SiteLayout";
import { getHome } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/")({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => getHome({ data: deps }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.site.title }] : [],
    links: [{ rel: "alternate", type: "application/rss+xml", href: "/site/feed.xml" }],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const home = data.home;
  return (
    <SiteLayout chrome={data}>
      {home.kind === "page" ? (
        <article className="space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight">{home.page.title}</h1>
          <Blocks blocks={home.page.blocks} mediaBase="/site/media" />
        </article>
      ) : (
        <PostList posts={home.posts} page={home.page} pages={home.pages} base="/site" empty="Nothing published yet." />
      )}
    </SiteLayout>
  );
}
