import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { Blocks } from "@/client/components/Blocks";
import { PostMeta, SiteLayout, SiteNotFound } from "@/client/components/SiteLayout";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDate } from "@/client/lib/useAction";
import { getPost } from "@/serverFunctions/site";

export const Route = createFileRoute("/site/post/$slug")({
  validateSearch: z.object({
    comment: z.enum(["pending", "approved", "closed", "invalid"]).optional().catch(undefined),
    replyTo: z.string().optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    const data = await getPost({ data: { slug: params.slug } });
    if (!data.post) throw notFound();
    return { ...data, post: data.post };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.post.title} · ${loaderData.site.title}` }] : [],
  }),
  component: PostPage,
  notFoundComponent: SiteNotFound,
});

const NOTICES = {
  pending: "Thanks. Your comment is awaiting moderation.",
  approved: "Thanks. Your comment is published.",
  closed: "Comments are closed on this post.",
  invalid: "Fill in your name, a valid email and a comment.",
} as const;

type Comment = { id: string; parentId: string | null; authorName: string; body: string; createdAt: number };

function PostPage() {
  const data = Route.useLoaderData();
  const { comment, replyTo } = Route.useSearch();
  const post = data.post;
  const byParent = new Map<string | null, Comment[]>();
  const ids = new Set(post.comments.map((c) => c.id));
  for (const c of post.comments) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const replyingTo = replyTo ? post.comments.find((c) => c.id === replyTo) : undefined;

  const thread = (parent: string | null, depth: number) =>
    (byParent.get(parent) ?? []).map((c) => (
      <li key={c.id} data-testid="comment" className="space-y-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-sm">
            <span className="font-medium">{c.authorName}</span>{" "}
            <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
          </p>
          <p className="mt-1 whitespace-pre-line">{c.body}</p>
          {post.commentsOpen ? (
            <a href={`?replyTo=${c.id}#comment-form`} className="mt-2 inline-block text-sm text-primary hover:underline">
              Reply
            </a>
          ) : null}
        </div>
        {byParent.has(c.id) ? <ul className={`space-y-3 ${depth < 4 ? "pl-6" : ""}`}>{thread(c.id, depth + 1)}</ul> : null}
      </li>
    ));

  return (
    <SiteLayout chrome={data}>
      <article className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          <PostMeta authorId={post.author.id} authorName={post.author.name} publishAt={post.publishAt} />
        </header>
        <Blocks blocks={post.blocks} mediaBase="/site/media" />
        <footer className="space-y-1 text-sm text-muted-foreground">
          {post.categories.length ? (
            <p>
              Filed under{" "}
              {post.categories.map((c, i) => (
                <span key={c.slug}>
                  {i ? ", " : ""}
                  <a href={`/site/category/${c.slug}`} className="text-primary hover:underline">
                    {c.name}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
          {post.tags.length ? (
            <p>
              Tagged{" "}
              {post.tags.map((t, i) => (
                <span key={t.slug}>
                  {i ? ", " : ""}
                  <a href={`/site/tag/${t.slug}`} className="text-primary hover:underline">
                    {t.name}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </footer>
        {post.author.bio ? (
          <aside className="rounded-xl border border-border bg-card p-4 text-sm shadow-xs">
            <p className="font-medium">{post.author.name}</p>
            <p className="text-muted-foreground">{post.author.bio}</p>
          </aside>
        ) : null}
      </article>

      <section id="comments" className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          {post.comments.length ? `${post.comments.length} ${post.comments.length === 1 ? "comment" : "comments"}` : "Comments"}
        </h2>
        {comment ? (
          <p data-testid="comment-notice" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            {NOTICES[comment]}
          </p>
        ) : null}
        {post.comments.length ? <ul className="space-y-3">{thread(null, 0)}</ul> : null}
        {post.commentsOpen ? (
          <form id="comment-form" action="/site/comments" method="post" className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
            <h3 className="font-medium">
              {replyingTo ? `Reply to ${replyingTo.authorName}` : "Leave a comment"}
            </h3>
            <input type="hidden" name="postId" value={post.id} />
            {replyingTo ? <input type="hidden" name="parentId" value={replyingTo.id} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="comment-name">Name</Label>
                <Input id="comment-name" name="name" required maxLength={100} data-testid="comment-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comment-email">Email</Label>
                <Input id="comment-email" name="email" type="email" required maxLength={200} data-testid="comment-email" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Your email isn't published.</p>
            <div className="space-y-1.5">
              <Label htmlFor="comment-body">Comment</Label>
              <Textarea id="comment-body" name="body" required maxLength={5000} rows={4} data-testid="comment-body" />
            </div>
            <Button type="submit" data-testid="comment-submit">
              Post comment
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Comments are closed.</p>
        )}
      </section>
    </SiteLayout>
  );
}
