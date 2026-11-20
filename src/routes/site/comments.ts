import { createFileRoute } from "@tanstack/react-router";
import { addVisitorComment } from "@/server/comments";

// Public: the comment form on a post posts here, then goes back to the post.
export const Route = createFileRoute("/site/comments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const length = Number(request.headers.get("content-length") ?? 0);
        const form = length > 20_000 ? null : await request.formData().catch(() => null);
        const fields = form ? Object.fromEntries([...form].filter(([, v]) => typeof v === "string")) : {};
        const { outcome, slug } = await addVisitorComment(fields);
        const target = slug ? `/site/post/${encodeURIComponent(slug)}?comment=${outcome}#comments` : `/site?comment=${outcome}`;
        return new Response(null, { status: 303, headers: { location: target } });
      },
    },
  },
});
