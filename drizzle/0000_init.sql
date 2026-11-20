CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`parent_id` text,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_content` ON `comments` (`content_id`,`status`);--> statement-breakpoint
CREATE INDEX `comments_email` ON `comments` (`author_email`,`status`);--> statement-breakpoint
CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`body_text` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`publish_at` integer,
	`author_id` text NOT NULL,
	`parent_id` text,
	`comments_open` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_type_slug` ON `content` (`type`,`slug`);--> statement-breakpoint
CREATE INDEX `content_status` ON `content` (`status`,`publish_at`);--> statement-breakpoint
CREATE INDEX `content_author` ON `content` (`author_id`);--> statement-breakpoint
CREATE TABLE `content_terms` (
	`content_id` text NOT NULL,
	`term_id` text NOT NULL,
	PRIMARY KEY(`content_id`, `term_id`)
);
--> statement-breakpoint
CREATE INDEX `content_terms_term` ON `content_terms` (`term_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`uploader_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`blocks` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `revisions_content` ON `revisions` (`content_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_title` text NOT NULL,
	`tagline` text NOT NULL,
	`posts_per_page` integer NOT NULL,
	`default_role` text NOT NULL,
	`comments_default_open` integer NOT NULL,
	`front_page_id` text
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_kind_slug` ON `terms` (`kind`,`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
