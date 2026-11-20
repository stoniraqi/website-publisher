import { createFileRoute, notFound } from "@tanstack/react-router";
import { Blocks } from "@/client/components/Blocks";
import { SiteLayout, SiteNotFound } from "@/client/components/SiteLayout";
import { getPage } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/$slug")({
  loader: async ({ params }) => {
    const data = await getPage({ data: { slug: params.slug } });
    if (!data.page) throw notFound();
    return { ...data, page: data.page };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.page.title} · ${loaderData.site.title}` }] : [],
  }),
  component: StandalonePage,
  notFoundComponent: SiteNotFound,
});

function StandalonePage() {
  const data = Route.useLoaderData();
  const page = data.page;
  return (
    <SiteLayout chrome={data}>
      <article className="space-y-6">
        {page.parent ? (
          <a href={`/site/${page.parent.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← {page.parent.title}
          </a>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        <Blocks blocks={page.blocks} mediaBase="/site/media" />
        {page.children.length ? (
          <ul className="list-disc space-y-1 pl-6">
            {page.children.map((c) => (
              <li key={c.slug}>
                <a href={`/site/${c.slug}`} className="text-primary hover:underline">
                  {c.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </SiteLayout>
  );
}
