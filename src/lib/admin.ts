import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * The platform moderator.
 *
 * isAdmin is set by hand in the database and nothing in the application
 * can grant it, so there is no screen to get wrong and no privilege
 * escalation path to audit.
 *
 * A non-admin gets notFound rather than a 403: a page that answers
 * "forbidden" has told you it exists, and the moderation queue is not
 * something the rest of the world needs to know about.
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true, name: true },
  });
  if (!user?.isAdmin) notFound();

  return user;
}

/** The same check for an API route, which answers 404 for the same reason. */
export async function requireAdminApi(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true },
  });
  return user?.isAdmin ? { id: user.id } : null;
}
