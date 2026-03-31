import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Standard JSON response helpers */
export const ok = (data: unknown, status = 200) =>
  Response.json(data, { status });

export const err = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

/** Require a valid session. Returns session or throws 401 response. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw err("غير مصرح", 401);
  return session;
}

/** Require session + a linked business. Returns both or throws. */
export async function requireBusiness() {
  const session = await requireSession();
  if (!session.user.businessId) throw err("لم يتم العثور على عملك", 404);

  const business = await db.business.findUnique({
    where: { id: session.user.businessId },
  });
  if (!business) throw err("لم يتم العثور على عملك", 404);

  return { session, business };
}

/** Slugify an English string for URL use */
export function makeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}
