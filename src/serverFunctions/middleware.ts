import { createMiddleware } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { ensurePerson } from "@/server/users";

/** The signed-in member as a person of this site, created on first sight. */
export const personMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => next({ context: { person: await ensurePerson(context.user) } }));
