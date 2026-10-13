import { notFound } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { currentCaller } from "@/lib/api";
import { db } from "@/lib/db";
import { can, type Permission } from "./permissions";

/**
 * The server-side gate.
 *
 * Every admin page and every admin route begins here. Two things make
 * it worth having rather than checking in each place:
 *
 *   - The role is read from the database on every request, not from
 *     the session token. A token is minted at sign-in and lives for
 *     days; revoking somebody's access has to take effect now, not
 *     whenever they next sign in. One indexed lookup is a fair price
 *     for that.
 *
 *   - The answer to "you may not" is 404, not 403. A 403 confirms the
 *     page exists, which tells somebody probing exactly where to keep
 *     trying. Nothing about the admin panel needs to be discoverable.
 */

export interface AdminActor {
  id: string;
  name: string | null;
  role: AdminRole;
}

/** Reads the current user's admin role, or null for everybody else. */
export async function currentAdmin(): Promise<AdminActor | null> {
  // Cookie or bearer, so the app's admin space can call the admin API.
  // Only the id is taken from either: the role is read from the
  // database below, never from the token.
  const session = await currentCaller();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, adminRole: true },
  });
  if (!user?.adminRole) return null;

  return { id: user.id, name: user.name, role: user.adminRole };
}

/**
 * For a page. Renders the not-found page when the permission is
 * missing, so an admin URL is indistinguishable from a typo.
 */
export async function requireAdminPage(permission: Permission): Promise<AdminActor> {
  const actor = await currentAdmin();
  if (!actor || !can(actor.role, permission)) notFound();
  return actor;
}

/**
 * For an API route. Returns null rather than throwing so the caller
 * decides the shape of the refusal — but every caller answers 404, for
 * the same reason the pages do.
 */
export async function requireAdminApi(permission: Permission): Promise<AdminActor | null> {
  const actor = await currentAdmin();
  if (!actor || !can(actor.role, permission)) return null;
  return actor;
}

/** The 404 an admin route answers. Identical to a route that is not there. */
export function adminNotFound(): Response {
  return Response.json({ error: "غير موجود" }, { status: 404 });
}
