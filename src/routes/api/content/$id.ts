import { createFileRoute } from "@tanstack/react-router";
import * as content from "@/server/content";
import { asPerson } from "@/server/http";

export const Route = createFileRoute("/api/content/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        asPerson(request, async (person) => Response.json(await content.getContent(person, params.id))),
      PATCH: ({ request, params }) =>
        asPerson(request, async (person) => {
          const input = content.saveInput.parse(await request.json());
          return Response.json(await content.saveContent(person, params.id, input));
        }),
      DELETE: ({ request, params }) =>
        asPerson(request, async (person) => {
          await content.deleteContent(person, params.id);
          return new Response(null, { status: 204 });
        }),
    },
  },
});
