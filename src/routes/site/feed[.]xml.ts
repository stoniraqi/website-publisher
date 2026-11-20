import { createFileRoute } from "@tanstack/react-router";
import { feedItems, shorten, siteInfo } from "@/server/site";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Public: an RSS feed of the latest posts, linked on the request's own host.
export const Route = createFileRoute("/site/feed.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [site, items] = await Promise.all([siteInfo(), feedItems()]);
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>${esc(site.title)}</title>
<link>${origin}/site</link>
<description>${esc(site.tagline)}</description>
${items
  .map((i) => {
    const link = `${origin}/site/post/${encodeURIComponent(i.slug)}`;
    return `<item>
<title>${esc(i.title)}</title>
<link>${link}</link>
<guid>${link}</guid>
<pubDate>${new Date(i.publishAt ?? Date.now()).toUTCString()}</pubDate>
<dc:creator>${esc(i.authorName ?? "")}</dc:creator>
<description>${esc(i.excerpt || shorten(i.bodyText))}</description>
</item>`;
  })
  .join("\n")}
</channel>
</rss>`;
        return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
      },
    },
  },
});
