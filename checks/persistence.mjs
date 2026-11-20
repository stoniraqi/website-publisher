// Persistence: content, terms, media, comments and settings survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { api, html, upload, postComment, landscapePng } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const media = await upload(runtime, "owner", "dock.png", landscapePng(16, 16), "image/png");
  expect(media.status).toBe(201);
  const post = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Repainting the boathouse", status: "published", tags: ["boathouse"],
      blocks: [{ type: "paragraph", text: "Two coats of red." }, { type: "image", mediaId: media.data.id, alt: "The dock", caption: "" }] } });
  expect(post.status).toBe(201);
  const c = await postComment(runtime, { postId: post.data.id, name: "Lea", email: "lea@example.org", body: "Looks great" });
  expect(c.status).toBe(303);

  await runtime.restart();

  const read = await api(runtime, `/api/content/${post.data.id}`, { role: "owner" });
  expect(read.status).toBe(200);
  expect(read.data.title).toBe("Repainting the boathouse");
  expect(read.data.blocks[0].text).toBe("Two coats of red.");
  expect((await html(runtime, "/site/tag/boathouse")).text).toContain("Repainting the boathouse");
  const file = await runtime.fetch(`/site/media/${media.data.id}`);
  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toContain("image/png");
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/comments");
  await expect(page.getByTestId("comment-row").filter({ hasText: "Looks great" })).toBeVisible();
  const revisions = await (await runtime.database()).prepare("SELECT count(*) AS n FROM revisions WHERE content_id = ?").bind(post.data.id).first();
  expect(revisions.n).toBeGreaterThan(0);
} finally {
  await runtime.close();
}
