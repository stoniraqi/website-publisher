import { createFileRoute } from "@tanstack/react-router";
import { asPerson } from "@/server/http";
import { deleteMedia, memberFile } from "@/server/media";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => asPerson(request, (person) => memberFile(person, params.id)),
      DELETE: ({ request, params }) =>
        asPerson(request, async (person) => {
          await deleteMedia(person, params.id);
          return new Response(null, { status: 204 });
        }),
    },
  },
});
