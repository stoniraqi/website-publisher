import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Times are milliseconds since the epoch.

// One row per Gateway member, keyed by the Gateway's user id and created on
// first sight. Administrators are whoever the Gateway says is an admin; the
// stored role applies to everyone else.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  role: text("role").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const content = sqliteTable(
  "content",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // post | page
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    blocks: text("blocks").notNull().default("[]"),
    // Plain text of the blocks, for search.
    bodyText: text("body_text").notNull().default(""),
    status: text("status").notNull(), // draft | pending | scheduled | published | private | trash
    publishAt: integer("publish_at"),
    authorId: text("author_id").notNull(),
    parentId: text("parent_id"),
    commentsOpen: integer("comments_open", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("content_type_slug").on(t.type, t.slug),
    index("content_status").on(t.status, t.publishAt),
    index("content_author").on(t.authorId),
  ],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    blocks: text("blocks").notNull(),
    authorId: text("author_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("revisions_content").on(t.contentId, t.createdAt)],
);

export const terms = sqliteTable(
  "terms",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(), // category | tag
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: text("parent_id"),
  },
  (t) => [uniqueIndex("terms_kind_slug").on(t.kind, t.slug)],
);

export const contentTerms = sqliteTable(
  "content_terms",
  {
    contentId: text("content_id").notNull(),
    termId: text("term_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.termId] }), index("content_terms_term").on(t.termId)],
);

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  title: text("title").notNull().default(""),
  alt: text("alt").notNull().default(""),
  caption: text("caption").notNull().default(""),
  uploaderId: text("uploader_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id").notNull(),
    parentId: text("parent_id"),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(), // pending | approved | spam | trash
    userId: text("user_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_content").on(t.contentId, t.status), index("comments_email").on(t.authorEmail, t.status)],
);

// A single row (id 1).
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  siteTitle: text("site_title").notNull(),
  tagline: text("tagline").notNull(),
  postsPerPage: integer("posts_per_page").notNull(),
  defaultRole: text("default_role").notNull(),
  commentsDefaultOpen: integer("comments_default_open", { mode: "boolean" }).notNull(),
  frontPageId: text("front_page_id"),
});
