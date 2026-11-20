import { createFileRoute } from "@tanstack/react-router";
import * as content from "@/server/content";
import { asPerson } from "@/server/http";

// The content API: the same rules as the dashboard, for scripts with a
// personal access token.
export const Route = createFileRoute("/api/content/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        asPerson(request, async (person) => {
          const params = Object.fromEntries(new URL(request.url).searchParams);
          return Response.json(await content.listContent(person, content.listInput.parse(params)));
        }),
      POST: ({ request }) =>
        asPerson(request, async (person) => {
          const input = content.createInput.parse(await request.json());
          return Response.json(await content.createContent(person, input), { status: 201 });
        }),
    },
  },
});
