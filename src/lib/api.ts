import { headers } from "next/headers";
import { auth } from "@/auth";
import { readAccessToken } from "@/lib/auth/mobile-token";
import { db } from "@/lib/db";

/** Standard JSON response helpers */
export const ok = (data: unknown, status = 200) =>
  Response.json(data, { status });

export const err = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

/**
 * Require a signed-in caller.
 *
 * Two ways in, one session shape out.
 *
 * The browser sends a NextAuth cookie. A native app cannot sensibly
 * hold one, so it sends `Authorization: Bearer <access token>` instead
 * and this resolves it into the same object every route already
 * expects. That is the whole of the mobile integration: no route knows
 * which kind of client it is serving, and none had to be changed.
 *
 * The cookie is tried first, because the web is the common case and an
 * app would not be sending both.
 */
export async function requireSession(): Promise<CallerSession> {
  const session = await auth();
  if (session?.user?.id) return session as CallerSession;

  const bearer = await sessionFromBearer();
  if (bearer) return bearer;

  throw err("غير مصرح", 401);
}

/**
 * The session a bearer token stands for.
 *
 * Shaped exactly like the NextAuth one so callers cannot tell them
 * apart — anything that reads session.user.id or session.user.businessId
 * keeps working unchanged.
 *
 * The header is read from next/headers rather than from a Request
 * object so this can be called from the many routes that never take
 * one, and from server components.
 */
async function sessionFromBearer(): Promise<CallerSession | null> {
  const header = (await headers()).get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const claims = await readAccessToken(header.slice(7).trim());
  if (!claims) return null;

  return {
    user: {
      id: claims.sub,
      businessId: claims.businessId,
      adminRole: claims.adminRole,
    },
  };
}

/** The shape both paths produce. */
export interface CallerSession {
  user: {
    id: string;
    businessId?: string | null;
    adminRole?: string | null;
    [key: string]: unknown;
  };
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

