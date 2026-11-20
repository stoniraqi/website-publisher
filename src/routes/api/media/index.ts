import { createFileRoute } from "@tanstack/react-router";
import { invalid } from "@/server/errors";
import { asPerson } from "@/server/http";
import { MAX_UPLOAD_BYTES, uploadMedia } from "@/server/media";

// Uploads: a multipart form with one `file`.
export const Route = createFileRoute("/api/media/")({
  server: {
    handlers: {
      POST: ({ request }) =>
        asPerson(request, async (person) => {
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > MAX_UPLOAD_BYTES + 64 * 1024)
            return Response.json({ error: "Files can be up to 10 MB." }, { status: 413 });
          const form = await request.formData().catch(() => null);
          const file = form?.get("file");
          if (!(file instanceof File)) throw invalid("Choose a file to upload.");
          return Response.json(await uploadMedia(person, file), { status: 201 });
        }),
    },
  },
});
