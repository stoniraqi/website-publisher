import { createFileRoute } from "@tanstack/react-router";
import { publicFile } from "@/server/media";

// Public: files that published content uses, nothing else.
export const Route = createFileRoute("/site/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => (await publicFile(params.id)) ?? new Response("Not found", { status: 404 }),
    },
  },
});
