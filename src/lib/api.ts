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
/**
 * The signed-in owner and the business they own.
 *
 * The id comes from the token, which is signed and so cannot be edited
 * by its holder — but it is a snapshot taken at sign-in, and the
 * ownership it records can stop being true while the token is still
 * valid. Sessions last weeks. So the row is re-read and its ownerId is
 * checked against the account making the request, the same way the
 * admin guard re-reads a role rather than trusting the copy in the
 * token.
 *
 * A business has exactly one owner — Business.ownerId is unique — so
 * this is the whole of the question, not the first half of it.
 */
export async function requireBusiness() {
  const session = await requireSession();
  if (!session.user.businessId) throw err("لم يتم العثور على عملك", 404);

  const business = await db.business.findUnique({
    where: { id: session.user.businessId },
  });
  if (!business) throw err("لم يتم العثور على عملك", 404);

  // Not an authorisation error on purpose: a token naming a business
  // this account no longer owns is indistinguishable, from here, from
  // one naming a business that was deleted. Both mean "you have no
  // business", and saying anything more precise would confirm that
  // somebody else's business exists.
  if (business.ownerId !== session.user.id) {
    throw err("لم يتم العثور على عملك", 404);
  }

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
