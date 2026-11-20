import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.media), never the file.
export default defineEveryApp({
  id: "website-publisher",
  name: "Website Publisher",
  description: "Write posts and pages with blocks and publish them as a public website with comments.",
  icon: "/icon.svg",
  resources: {
    // People, content, revisions, categories, tags, comments and settings.
    d1: ["DB"],
    // Uploaded images and files (src/server/media.ts).
    r2: ["media"],
  },
  // Every member can open the dashboard; what each may do comes from their
  // role on the site (src/server/permissions.ts).
  access: "everyone",
  // Only the public website is open to visitors. Every /site route reads
  // published content only (src/server/site.ts); /site/comments takes
  // visitor comments, held for moderation.
  public: [
    { path: "/site", methods: ["GET"] },
    { path: "/site/**", methods: ["GET"] },
    { path: "/site/comments", methods: ["POST"] },
    // The styles and scripts the public pages load, and the icon.
    { path: "/assets/**", methods: ["GET"] },
    { path: "/icon.svg", methods: ["GET"] },
  ],
});
