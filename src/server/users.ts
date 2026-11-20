import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { isAdmin } from "@every-app/sdk/server";
import { db } from "@/db";
import { content, users } from "@/db/schema";
import { forbidden, notFound } from "@/server/errors";
import { ASSIGNABLE_ROLES, type Actor, type Role, ROLES } from "@/server/permissions";
import { getSettings } from "@/server/settings";

export interface Person extends Actor {
  email: string;
  displayName: string;
  bio: string;
}

interface Identity {
  id: string;
  email: string;
  orgRole: string;
}

function effectiveRole(identity: Identity, stored: string): Role {
  if (isAdmin(identity)) return "administrator";
  if (stored === "administrator") return "subscriber";
  return (ROLES as readonly string[]).includes(stored) ? (stored as Role) : "subscriber";
}

/** The person behind a verified identity, created with the site's default role on first sight. */
export async function ensurePerson(identity: Identity): Promise<Person> {
  let [row] = await db.select().from(users).where(eq(users.id, identity.id));
  if (!row) {
    const { defaultRole } = await getSettings();
    await db
      .insert(users)
      .values({
        id: identity.id,
        email: identity.email,
        displayName: identity.email.split("@")[0] || identity.email,
        role: isAdmin(identity) ? "administrator" : defaultRole,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
    [row] = await db.select().from(users).where(eq(users.id, identity.id));
  } else if (row.email !== identity.email) {
    await db.update(users).set({ email: identity.email }).where(eq(users.id, identity.id));
    row = { ...row, email: identity.email };
  }
  return {
    id: row!.id,
    email: row!.email,
    displayName: row!.displayName,
    bio: row!.bio,
    role: effectiveRole(identity, row!.role),
  };
}

export interface PersonRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  posts: number;
}

export async function listPeople(actor: Actor): Promise<PersonRow[]> {
  if (actor.role !== "administrator") throw forbidden();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      posts: count(content.id),
    })
    .from(users)
    .leftJoin(content, and(eq(content.authorId, users.id), eq(content.type, "post"), ne(content.status, "trash")))
    .groupBy(users.id)
    .orderBy(users.email);
  return rows.map((r) => ({ ...r, role: (ROLES as readonly string[]).includes(r.role) ? (r.role as Role) : "subscriber" }));
}

export const setRoleInput = z.object({ userId: z.string().min(1).max(200), role: z.enum(ASSIGNABLE_ROLES) }).strict();

export async function setRole(actor: Actor, input: z.infer<typeof setRoleInput>): Promise<void> {
  if (actor.role !== "administrator") throw forbidden();
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, input.userId));
  if (!row) throw notFound("That person");
  await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
}

export const profileInput = z
  .object({
    displayName: z.string().trim().min(1, "Enter a display name.").max(80),
    bio: z.string().trim().max(500),
  })
  .strict();

export async function updateProfile(actor: Actor, input: z.infer<typeof profileInput>): Promise<void> {
  await db.update(users).set(input).where(eq(users.id, actor.id));
}
