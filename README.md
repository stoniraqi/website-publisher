# Website Publisher

Write posts and pages from blocks, organise them with categories and tags, and publish them as a public website where visitors can comment. Your team works in a private dashboard; anyone can read what you publish.

Inspired by https://wordpress.org

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Write posts and pages from paragraph, heading, list, quote, image and separator blocks, with drafts, review, scheduling, private items, trash and revisions.
- Organise posts with nested categories and free-form tags.
- Upload images and files to a shared media library and use them in posts.
- Give each member a role (editor, author, contributor or subscriber) and edit your own byline.
- Publish a public website at `/site` with archives, search and an RSS feed.
- Take visitor comments, hold new ones for moderation and reply from the dashboard.
- Set the site's title, tagline, home page, posts per page, default role and comment default.

Left out: accounts and sign-in, which your Gateway handles; password-protected posts; themes and design tools; plugins; importers; translations and multi-site networks; custom domains.

## Setup

- Install: `pnpm everyapp install <repository url>`, or from a checkout `pnpm install` then `pnpm run deploy`.
- Run locally: `pnpm dev`.
- Test: `pnpm test` for unit tests; `checks/` holds the release checks.
- It needs no secrets or settings. The database and file storage are created on deploy; R2 must be enabled on the Cloudflare account once.
- Gateway administrators are the site's administrators. Everyone else starts with the default role (Contributor until you change it in Settings).

## Limitations

- The public website lives at `/site` on the app's own address; custom domains aren't available.
- Uploads are limited to 10 MB per file.
- Scheduled posts go live on the first visit after their time, not by a background job.
- Visitor comments have no spam filter beyond holding first-time commenters for approval.
