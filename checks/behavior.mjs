// Behavior: every retained feature's main path, against the release archive.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { api, html, upload, postComment, choose, landscapePng } from "./lib.mjs";

const runtime = await startRuntime();
const log = (s) => console.log(`- ${s}`);
try {
  const owner = await (await runtime.context("owner")).newPage();
  const visitor = await (await runtime.context(null)).newPage();

  // F004: first visits create people records; the member arrives with the default role.
  await owner.goto("/");
  await expect(owner.getByRole("heading", { name: "Content" })).toBeVisible();
  await runtime.assertBackLink(owner);
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/profile");
  await memberPage.getByTestId("display-name").fill("Maya Lindqvist");
  await memberPage.getByTestId("bio").fill("Writes about small harbors and long walks.");
  await Promise.all([
    memberPage.getByText("Profile saved").waitFor(),
    memberPage.getByTestId("save-profile").click(),
  ]);
  log("profile saved");

  // F007: site settings.
  await owner.goto("/settings");
  await owner.getByTestId("site-title").fill("Harbor Notes");
  await owner.getByTestId("tagline").fill("Stories from the coast");
  await owner.getByTestId("posts-per-page").fill("5");
  await Promise.all([
    owner.getByText("Settings saved").waitFor(),
    owner.getByTestId("save-settings").click(),
  ]);
  let site = await html(runtime, "/site");
  expect(site.status).toBe(200);
  expect(site.text).toContain("Harbor Notes");
  expect(site.text).toContain("Stories from the coast");
  log("settings");

  // F004: admin sees people with role and post count and changes a role.
  await owner.goto("/people");
  const memberRow = owner.getByTestId("person-row").filter({ hasText: "member@example.test" });
  await expect(memberRow).toContainText("Contributor");
  await expect(owner.getByTestId("person-row").filter({ hasText: "owner@example.test" })).toContainText("Administrator");
  await memberRow.getByTestId("role-select").click();
  await Promise.all([
    owner.getByText("Role changed").waitFor(),
    owner.getByRole("option", { name: "Author", exact: true }).click(),
  ]);
  const promoted = await api(runtime, "/api/content", {
    role: "member",
    method: "POST",
    body: { type: "post", title: "Low tide at the old pier", status: "published",
      blocks: [{ type: "paragraph", text: "The water pulled back past the pilings this morning." }] },
  });
  expect(promoted.status).toBe(201);
  expect(promoted.data.status).toBe("published");
  log("roles");

  // F003: upload, list, edit details.
  await owner.goto("/media");
  await owner.getByTestId("media-upload-input").setInputFiles({
    name: "harbor-sunrise.png", mimeType: "image/png", buffer: landscapePng(),
  });
  const item = owner.getByTestId("media-item").filter({ hasText: "harbor-sunrise.png" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("PNG");
  await item.click();
  await owner.getByTestId("media-alt").fill("Fishing boats at sunrise in the harbor");
  await owner.getByTestId("media-caption").fill("First light over the east harbor");
  await Promise.all([
    owner.getByText("Media saved").waitFor(),
    owner.getByTestId("save-media").click(),
  ]);
  await owner.keyboard.press("Escape");
  const unused = await upload(runtime, "owner", "notes.txt", Buffer.from("packing list"), "text/plain");
  expect(unused.status).toBe(201);
  log("media");

  // F002: categories and tags.
  await owner.goto("/terms");
  await owner.getByTestId("category-name").fill("Travel");
  await Promise.all([
    owner.getByTestId("term-row").filter({ hasText: "Travel" }).waitFor(),
    owner.getByTestId("category-add").click(),
  ]);
  await expect(owner.getByTestId("term-row").filter({ hasText: "Uncategorized" }).getByTestId("term-delete")).toHaveCount(0);
  log("terms");

  // F001: write a post with blocks, categories and tags, then publish it.
  await owner.goto("/edit/new?type=post");
  await owner.getByTestId("title-input").fill("A weekend on the northern coast");
  await owner.getByTestId("excerpt-input").fill("Two days of ferries, fish soup and fog.");
  await owner.getByTestId("add-paragraph").click();
  await owner.getByTestId("block").nth(0).getByTestId("block-text").fill("We took the early ferry and watched the islands appear out of the fog.");
  await owner.getByTestId("add-heading").click();
  await owner.getByTestId("block").nth(1).getByTestId("block-text").fill("Where we stayed");
  await owner.getByTestId("add-image").click();
  await owner.getByTestId("block").nth(2).getByTestId("block-pick-image").click();
  await owner.getByTestId("media-option").filter({ hasText: "harbor-sunrise.png" }).click();
  await expect(owner.getByTestId("block").nth(2).getByTestId("block-alt")).toHaveValue("Fishing boats at sunrise in the harbor");
  await owner.getByTestId("add-list").click();
  await owner.getByTestId("block").nth(3).getByTestId("block-text").fill("Fish soup at the pier\nThe lighthouse walk");
  await owner.getByTestId("add-quote").click();
  await owner.getByTestId("block").nth(4).getByTestId("block-text").fill("The fog lifts when it wants to.");
  // Move the quote above the list, then remove a separator added by mistake.
  await owner.getByTestId("block").nth(4).getByTestId("block-up").click();
  await expect(owner.getByTestId("block").nth(3).getByTestId("block-text")).toHaveValue("The fog lifts when it wants to.");
  await owner.getByTestId("add-separator").click();
  await expect(owner.getByTestId("block")).toHaveCount(6);
  await owner.getByTestId("block").nth(5).getByTestId("block-remove").click();
  await expect(owner.getByTestId("block")).toHaveCount(5);
  await owner.getByRole("checkbox", { name: "Travel" }).click();
  await owner.getByTestId("tag-input").fill("coast");
  await owner.getByTestId("tag-input").press("Enter");
  await expect(owner.getByTestId("tag-chip").filter({ hasText: "coast" })).toBeVisible();
  await choose(owner, "status-select", "Published");
  await Promise.all([owner.waitForURL(/\/edit\/[0-9a-f-]{36}/), owner.getByTestId("save").click()]);
  await expect(owner.getByTestId("slug-input")).toHaveValue("a-weekend-on-the-northern-coast");
  const postId = owner.url().split("/edit/")[1].split("?")[0];
  log("post published");

  // Revisions: change, then preview and restore the first one.
  await owner.getByTestId("title-input").fill("Working title");
  await Promise.all([owner.getByText("Saved").first().waitFor(), owner.getByTestId("save").click()]);
  await expect(owner.getByTestId("revision-row")).toHaveCount(2);
  await expect(owner.getByTestId("revision-row").first()).toContainText("owner");
  const firstRevision = owner.getByTestId("revision-row").last();
  await firstRevision.getByTestId("revision-preview").click();
  await expect(owner.getByRole("dialog")).toContainText("A weekend on the northern coast");
  await owner.keyboard.press("Escape");
  await firstRevision.getByTestId("revision-restore").click();
  await expect(owner.getByTestId("title-input")).toHaveValue("A weekend on the northern coast");
  await expect(owner.getByTestId("revision-row")).toHaveCount(3);
  log("revisions");

  // F001 lists: counts per status, filters and search.
  await api(runtime, "/api/content", { role: "owner", method: "POST", body: { type: "post", title: "Packing list ideas" } });
  await owner.goto("/");
  await expect(owner.getByTestId("status-tab-draft")).toContainText("1");
  await expect(owner.getByTestId("status-tab-published")).toContainText("2");
  await owner.getByTestId("content-search").fill("northern");
  await owner.getByTestId("content-search").press("Enter");
  await expect(owner.getByTestId("content-row")).toHaveCount(1);
  await expect(owner.getByTestId("content-row")).toContainText("A weekend on the northern coast");
  await owner.goto("/?status=draft");
  await expect(owner.getByTestId("content-row")).toHaveCount(1);
  await expect(owner.getByTestId("content-row")).toContainText("Packing list ideas");
  await owner.goto("/?author=member");
  await expect(owner.getByTestId("content-row")).toHaveCount(1);
  await expect(owner.getByTestId("content-row")).toContainText("Low tide at the old pier");
  log("lists");

  // Slugs stay unique per type; trash, restore and delete.
  const twin = await api(runtime, "/api/content", { role: "owner", method: "POST", body: { type: "post", title: "Packing list ideas" } });
  expect(twin.data.slug).toBe("packing-list-ideas-2");
  expect((await api(runtime, `/api/content/${twin.data.id}`, { role: "owner", method: "PATCH", body: { status: "trash" } })).data.status).toBe("trash");
  expect((await api(runtime, `/api/content/${twin.data.id}`, { role: "owner", method: "PATCH", body: { status: "draft" } })).data.status).toBe("draft");
  await api(runtime, `/api/content/${twin.data.id}`, { role: "owner", method: "PATCH", body: { status: "trash" } });
  expect((await api(runtime, `/api/content/${twin.data.id}`, { role: "owner", method: "DELETE" })).status).toBe(204);
  expect((await api(runtime, `/api/content/${twin.data.id}`, { role: "owner" })).status).toBe(404);

  // Scheduled and private content stay off the site until due.
  const future = new Date(Date.now() + 7 * 86400_000).toISOString();
  const scheduled = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Autumn ferry timetable", status: "published", publishAt: future,
      blocks: [{ type: "paragraph", text: "Ferries run twice a day from October." }] } });
  expect(scheduled.data.status).toBe("scheduled");
  const secret = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "post", title: "Budget for next season", status: "private" } });
  expect(secret.data.status).toBe("private");
  site = await html(runtime, "/site");
  expect(site.text).not.toContain("Autumn ferry timetable");
  expect(site.text).not.toContain("Budget for next season");
  expect(site.text).not.toContain("Packing list ideas");
  await (await runtime.database()).prepare("UPDATE content SET publish_at = ? WHERE id = ?")
    .bind(Date.now() - 60_000, scheduled.data.id).run();
  site = await html(runtime, "/site");
  expect(site.text).toContain("Autumn ferry timetable");
  log("scheduling and visibility");

  // F005: the public site.
  await visitor.goto("/site");
  await expect(visitor.getByRole("link", { name: "A weekend on the northern coast" })).toBeVisible();
  await expect(visitor.getByText("Two days of ferries, fish soup and fog.")).toBeVisible();
  await visitor.getByRole("link", { name: "A weekend on the northern coast" }).click();
  await expect(visitor).toHaveURL(/\/site\/post\/a-weekend-on-the-northern-coast/);
  await expect(visitor.getByRole("heading", { name: "Where we stayed" })).toBeVisible();
  await expect(visitor.getByText("The fog lifts when it wants to.")).toBeVisible();
  await expect(visitor.getByText("The lighthouse walk")).toBeVisible();
  const img = visitor.getByRole("img", { name: "Fishing boats at sunrise in the harbor" });
  await expect(img).toBeVisible();
  await expect(visitor.getByText("First light over the east harbor")).toBeVisible();
  const src = await img.getAttribute("src");
  expect((await runtime.fetch(src)).status).toBe(200);
  expect((await runtime.fetch(`/site/media/${unused.data.id}`)).status).toBe(404);
  await expect(visitor.getByRole("link", { name: "Travel" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "coast" })).toBeVisible();
  expect((await html(runtime, "/site/category/travel")).text).toContain("A weekend on the northern coast");
  expect((await html(runtime, "/site/tag/coast")).text).toContain("A weekend on the northern coast");
  // A post without a category lands in Uncategorized.
  expect((await html(runtime, "/site/category/uncategorized")).text).toContain("Low tide at the old pier");
  const author = await html(runtime, "/site/author/member");
  expect(author.text).toContain("Maya Lindqvist");
  expect(author.text).toContain("Writes about small harbors and long walks.");
  expect(author.text).toContain("Low tide at the old pier");
  const search = await html(runtime, "/site/search?q=pilings");
  expect(search.text).toContain("Low tide at the old pier");
  expect(search.text).not.toContain("A weekend on the northern coast");
  const feed = await runtime.fetch("/site/feed.xml");
  expect(feed.status).toBe(200);
  const feedText = await feed.text();
  expect(feedText).toContain("<rss");
  expect(feedText).toContain(`http://${runtime.hostname}/site/post/a-weekend-on-the-northern-coast`);
  expect(feedText).not.toContain("Budget for next season");
  log("public site");

  // Pages: standalone, with a parent, and as the front page.
  const about = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "page", title: "About this site", status: "published",
      blocks: [{ type: "paragraph", text: "Notes from a family that never stays inland for long." }] } });
  expect(about.status).toBe(201);
  const child = await api(runtime, "/api/content", { role: "owner", method: "POST",
    body: { type: "page", title: "Contact", status: "published", parentId: about.data.id,
      blocks: [{ type: "paragraph", text: "Write to us from any harbor." }] } });
  expect(child.data.parentId).toBe(about.data.id);
  expect((await html(runtime, "/site/about-this-site")).text).toContain("never stays inland");
  expect((await html(runtime, "/site/contact")).text).toContain("About this site");
  await owner.goto("/settings");
  await choose(owner, "front-page", "About this site");
  await Promise.all([owner.getByText("Settings saved").waitFor(), owner.getByTestId("save-settings").click()]);
  expect((await html(runtime, "/site")).text).toContain("never stays inland");
  await choose(owner, "front-page", "Latest posts");
  await Promise.all([owner.getByText("Settings saved").waitFor(), owner.getByTestId("save-settings").click()]);
  log("pages");

  // F006: comments held, auto-approved, threaded, closed.
  await visitor.goto("/site/post/a-weekend-on-the-northern-coast");
  await visitor.getByTestId("comment-name").fill("Jonas");
  await visitor.getByTestId("comment-email").fill("jonas@example.org");
  await visitor.getByTestId("comment-body").fill("We did the lighthouse walk last summer. Worth it!");
  await Promise.all([visitor.waitForURL(/comment=pending/), visitor.getByTestId("comment-submit").click()]);
  await expect(visitor.getByTestId("comment-notice")).toBeVisible();
  await expect(visitor.getByTestId("comment")).toHaveCount(0);
  await owner.goto("/comments");
  await expect(owner.getByTestId("comment-tab-pending")).toContainText("1");
  const pending = owner.getByTestId("comment-row").filter({ hasText: "lighthouse walk last summer" });
  await expect(pending).toContainText("jonas@example.org");
  await Promise.all([owner.getByText("Comment approved").waitFor(), pending.getByTestId("comment-approve").click()]);
  await owner.goto("/comments?status=approved");
  const approved = owner.getByTestId("comment-row").filter({ hasText: "lighthouse walk last summer" });
  await approved.getByTestId("comment-reply").click();
  await owner.getByTestId("reply-body").fill("Glad you made it up there, Jonas.");
  await Promise.all([owner.getByText("Reply posted").waitFor(), owner.getByTestId("reply-submit").click()]);
  const page1 = await html(runtime, "/site/post/a-weekend-on-the-northern-coast");
  expect(page1.text).toContain("lighthouse walk last summer");
  expect(page1.text).toContain("Glad you made it up there");
  expect(page1.text).not.toContain("jonas@example.org");
  expect(page1.text).not.toContain("owner@example.test");
  const firstComment = (await (await runtime.database()).prepare("SELECT id FROM comments WHERE author_email = ?").bind("jonas@example.org").first()).id;
  const again = await postComment(runtime, { postId, name: "Jonas", email: "jonas@example.org", body: "Back again with a reply.", parentId: firstComment });
  expect(again.status).toBe(303);
  expect(again.location).toContain("comment=approved");
  const stranger = await postComment(runtime, { postId, name: "Spammy", email: "deals@example.net", body: "Cheap ferry tickets here" });
  expect(stranger.location).toContain("comment=pending");
  await owner.goto("/comments?status=pending");
  const spamRow = owner.getByTestId("comment-row").filter({ hasText: "Cheap ferry tickets" });
  await Promise.all([owner.getByText("Marked as spam").waitFor(), spamRow.getByTestId("comment-spam").click()]);
  await expect(owner.getByTestId("comment-tab-spam")).toContainText("1");
  await api(runtime, `/api/content/${promoted.data.id}`, { role: "owner", method: "PATCH", body: { commentsOpen: false } });
  const closed = await postComment(runtime, { postId: promoted.data.id, name: "Ana", email: "ana@example.org", body: "Hello" });
  expect(closed.location).toContain("comment=closed");
  log("comments");

  // F002: rename and delete a tag.
  await owner.goto("/terms");
  const tagRow = owner.getByTestId("term-row").filter({ hasText: "coast" });
  await tagRow.getByTestId("term-rename").click();
  await owner.getByTestId("term-rename-input").fill("Coastline");
  await Promise.all([owner.getByText("Renamed").waitFor(), owner.getByTestId("term-rename-save").click()]);
  await expect(owner.getByTestId("term-row").filter({ hasText: "Coastline" })).toBeVisible();

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByRole("heading", { name: "Content" })).toBeVisible();
  await expect(phone.getByTestId("content-row").first()).toBeVisible();
  await phone.goto("/site");
  await expect(phone.getByText("Harbor Notes").first()).toBeVisible();
  log("phone");

  // The result on screen: the published post with its approved comments.
  await owner.goto("/profile");
  await owner.getByTestId("display-name").fill("Erik Dahl");
  await Promise.all([owner.getByText("Profile saved").waitFor(), owner.getByTestId("save-profile").click()]);
  await owner.goto("/site/post/a-weekend-on-the-northern-coast");
  await expect(owner.getByTestId("comment").first()).toBeVisible();
  await expect(owner.getByText("Erik Dahl").first()).toBeVisible();
  await expect(owner.getByRole("img", { name: "Fishing boats at sunrise in the harbor" })).toHaveJSProperty("complete", true);
  await runtime.screenshot(owner);
  log("done");
} finally {
  await runtime.close();
}
