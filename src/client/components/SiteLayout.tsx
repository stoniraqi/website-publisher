import { Rss, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/client/components/ui/input";
import { formatDay } from "@/client/lib/useAction";

export interface SiteChrome {
  site: { title: string; tagline: string };
  nav: { title: string; slug: string }[];
}

/**
 * The public website's frame. Links are plain anchors: each page is rendered
 * on the server, so visitors never call the app's private endpoints.
 */
export function SiteLayout({ chrome, q, children }: { chrome: SiteChrome; q?: string; children: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-6 md:px-10">
          <div className="min-w-0">
            <a href="/site" className="text-2xl font-semibold tracking-tight hover:underline">
              {chrome.site.title}
            </a>
            {chrome.site.tagline ? <p className="text-sm text-muted-foreground">{chrome.site.tagline}</p> : null}
          </div>
          <form action="/site/search" method="get" className="relative w-full sm:w-56" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search" aria-label="Search the site" className="pl-8" />
          </form>
          {chrome.nav.length > 0 ? (
            <nav className="flex w-full flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href="/site" className="text-muted-foreground hover:text-foreground">
                Home
              </a>
              {chrome.nav.map((p) => (
                <a key={p.slug} href={`/site/${p.slug}`} className="text-muted-foreground hover:text-foreground">
                  {p.title}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-10 px-4 pt-10 pb-24 md:px-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-6 text-sm text-muted-foreground md:px-10">
          <span>{chrome.site.title}</span>
          <a href="/site/feed.xml" className="inline-flex items-center gap-1 hover:text-foreground">
            <Rss className="size-4" aria-hidden /> Feed
          </a>
        </div>
      </footer>
    </div>
  );
}

export interface Summary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishAt: number;
  authorId: string;
  authorName: string;
  comments: number;
}

export function PostList({
  posts,
  page,
  pages,
  base,
  empty,
}: {
  posts: Summary[];
  page: number;
  pages: number;
  base: string;
  empty: string;
}) {
  if (posts.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  const join = base.includes("?") ? "&" : "?";
  return (
    <div className="space-y-10">
      {posts.map((p) => (
        <article key={p.id} className="space-y-2" data-testid="site-post">
          <h2 className="text-2xl font-semibold tracking-tight">
            <a href={`/site/post/${p.slug}`} className="hover:underline">
              {p.title || "(no title)"}
            </a>
          </h2>
          <PostMeta authorId={p.authorId} authorName={p.authorName} publishAt={p.publishAt} comments={p.comments} />
          {p.excerpt ? <p className="leading-relaxed">{p.excerpt}</p> : null}
        </article>
      ))}
      {pages > 1 ? (
        <nav className="flex justify-between text-sm">
          {page > 1 ? (
            <a href={`${base}${join}page=${page - 1}`} className="text-primary hover:underline">
              ← Newer posts
            </a>
          ) : (
            <span />
          )}
          {page < pages ? (
            <a href={`${base}${join}page=${page + 1}`} className="text-primary hover:underline">
              Older posts →
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export function PostMeta({
  authorId,
  authorName,
  publishAt,
  comments,
}: {
  authorId: string;
  authorName: string;
  publishAt: number;
  comments?: number;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {formatDay(publishAt)} · <a href={`/site/author/${encodeURIComponent(authorId)}`} className="hover:underline">{authorName}</a>
      {comments ? ` · ${comments} ${comments === 1 ? "comment" : "comments"}` : null}
    </p>
  );
}

export function SiteNotFound() {
  return (
    <div className="mx-auto max-w-3xl space-y-2 px-4 py-24 text-center md:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        <a href="/site" className="text-primary hover:underline">
          Go to the home page
        </a>
      </p>
    </div>
  );
}
