// Authorization: private paths, public exposure, ownership, roles and admin-only actions.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { api, html, upload, postComment, landscapePng } from "./lib.mjs";

const runtime = await startRuntime();
const log = (s) => console.log(`- ${s}`);
try {
  await runtime.assertPrivateAccess(["/", "/media", "/comments", "/terms", "/profile", "/api/content"]);
  log("private paths");

  // Anonymous and outsider are refused on the JSON API and media.
  for (const role of [undefined, "outsider"]) {
    expect([401, 403]).toContain((await api(runtime, "/api/content", { role, method: "POST", body: { type: "post", title: "x" } })).status);
  }

  // The member arrives as a contributor (the default role).
  const draft = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Owner private draft", blocks: [{ type: "paragraph", text: "draft body" }] } });
  expect(draft.status).toBe(201);
  const priv = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Owner private notes", status: "private" } });
  const published = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Owner published story", status: "published",
      blocks: [{ type: "paragraph", text: "Public words" }] } });

  // One member never reads or changes another's private objects.
  for (const id of [draft.data.id, priv.data.id]) {
    expect((await api(runtime, `/api/content/${id}`, { role: "member" })).status).toBe(404);
    expect((await api(runtime, `/api/content/${id}`, { role: "member", method: "PATCH", body: { title: "hijacked" } })).status).toBe(404);
    expect((await api(runtime, `/api/content/${id}`, { role: "member", method: "DELETE" })).status).toBe(404);
  }
  expect((await api(runtime, `/api/content/${published.data.id}`, { role: "member", method: "PATCH", body: { title: "hijacked" } })).status).toBe(403);
  const list = await api(runtime, "/api/content", { role: "member" });
  expect(list.status).toBe(200);
  const titles = list.data.items.map((i) => i.title);
  expect(titles).not.toContain("Owner private draft");
  expect(titles).not.toContain("Owner private notes");
  log("ownership");

  // Contributor rules: own drafts and pending only; no pages, no publishing, no uploads.
  expect((await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "post", title: "x", status: "published" } })).status).toBe(403);
  expect((await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "page", title: "x" } })).status).toBe(403);
  const mine = await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "post", title: "Member pitch" } });
  expect(mine.status).toBe(201);
  expect((await api(runtime, `/api/content/${mine.data.id}`, { role: "member", method: "PATCH", body: { status: "pending" } })).data.status).toBe("pending");
  expect((await api(runtime, `/api/content/${mine.data.id}`, { role: "member", method: "PATCH", body: { status: "published" } })).status).toBe(403);
  expect((await upload(runtime, "member", "a.png", landscapePng(8, 8), "image/png")).status).toBe(403);
  // An editor-level person publishes it; the contributor can no longer edit it.
  expect((await api(runtime, `/api/content/${mine.data.id}`, { role: "owner", method: "PATCH", body: { status: "published" } })).data.status).toBe("published");
  expect((await api(runtime, `/api/content/${mine.data.id}`, { role: "member", method: "PATCH", body: { title: "changed" } })).status).toBe(403);
  log("contributor");

  // Media: members can't delete what others uploaded.
  const media = await upload(runtime, "owner", "pier.png", landscapePng(8, 8), "image/png");
  expect(media.status).toBe(201);
  await (await runtime.database()).prepare("UPDATE users SET role = 'author' WHERE id = 'member'").run();
  expect((await api(runtime, `/api/media/${media.data.id}`, { role: "member", method: "DELETE" })).status).toBe(403);
  const own = await upload(runtime, "member", "mine.png", landscapePng(8, 8), "image/png");
  expect(own.status).toBe(201);
  expect((await api(runtime, `/api/media/${own.data.id}`, { role: "member", method: "DELETE" })).status).toBe(204);
  // Authors publish their own posts, never pages, never others' posts.
  expect((await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "post", title: "Author post", status: "published" } })).status).toBe(201);
  expect((await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "page", title: "x" } })).status).toBe(403);
  expect((await api(runtime, `/api/content/${published.data.id}`, { role: "member", method: "DELETE" })).status).toBe(403);
  // Media is not public unless published content uses it.
  expect((await runtime.fetch(`/site/media/${media.data.id}`)).status).toBe(404);
  expect([401, 403]).toContain((await runtime.fetch(`/api/media/${media.data.id}`)).status);
  log("author and media");

  // Admin-only pages refuse non-admins; subscribers can't write.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/settings");
  await expect(memberPage.getByTestId("admin-only")).toBeVisible();
  await expect(memberPage.getByTestId("save-settings")).toHaveCount(0);
  await memberPage.goto("/people");
  await expect(memberPage.getByTestId("admin-only")).toBeVisible();
  await expect(memberPage.getByTestId("person-row")).toHaveCount(0);
  await memberPage.goto("/comments");
  await expect(memberPage.getByText("Owner published story")).toHaveCount(0);
  await (await runtime.database()).prepare("UPDATE users SET role = 'subscriber' WHERE id = 'member'").run();
  expect((await api(runtime, "/api/content", { role: "member", method: "POST", body: { type: "post", title: "x" } })).status).toBe(403);
  log("admin-only and subscriber");

  // Public routes expose only published content and no email addresses.
  const c = await postComment(runtime, { postId: published.data.id, name: "Reader", email: "reader@example.org", body: "Nice story" });
  expect(c.location).toContain("comment=pending");
  expect((await postComment(runtime, { postId: draft.data.id, name: "R", email: "r@example.org", body: "hi" })).location).toContain("comment=closed");
  const home = await html(runtime, "/site");
  expect(home.status).toBe(200);
  expect(home.text).toContain("Owner published story");
  for (const hidden of ["Owner private draft", "Owner private notes", "@example.test", "@example.org"]) expect(home.text).not.toContain(hidden);
  const post = await html(runtime, `/site/post/${published.data.slug}`);
  expect(post.text).not.toContain("Nice story");
  expect(post.text).not.toContain("reader@example.org");
  expect((await html(runtime, `/site/post/${draft.data.slug}`)).status).toBe(404);
  expect((await html(runtime, `/site/post/${priv.data.slug}`)).status).toBe(404);
  expect((await html(runtime, "/site/search?q=draft")).text).not.toContain("Owner private draft");
  log("public exposure");

  // The app serves no sign-in page of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/register", "/site/login"]) {
    const r = await runtime.fetch(path, { role: "owner" });
    expect(r.status === 404 || r.status === 401 || r.status === 403).toBe(true);
  }
  const anon = await (await runtime.context(null)).newPage();
  await anon.goto("/site");
  await expect(anon.locator('input[type="password"]')).toHaveCount(0);
  log("no sign-in");
} finally {
  await runtime.close();
}
