import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import { ensurePerson, type Person } from "@/server/users";

/** Runs a JSON endpoint as the signed-in member, mapping refusals to statuses. */
export async function asPerson(request: Request, work: (person: Person) => Promise<Response>): Promise<Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return await work(await ensurePerson(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
  throw error;
}
