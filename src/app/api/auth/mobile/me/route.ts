import { err, requireSession } from "@/lib/api";
import { claimsForUser } from "@/lib/auth/mobile-token";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * GET /api/auth/mobile/me
 *
 * Who this token belongs to, and what it may see.
 *
 * The app calls this on every cold start. It had been calling
 * GET /api/account/profile, which does not exist — that file has only a
 * PATCH — so the request 404'd, the store treated the failure as an
 * expired session, cleared the tokens, and showed the login screen.
 * Every launch signed the user out, and because the catch was silent
 * nothing said why.
 *
 * It returns identity and roles, not profile details. Those are two
 * different questions: this one decides which set of screens to open,
 * and GET /api/account/profile answers what to put on the account
 * screen. Shaped exactly like the `user` in the login response so the
 * app has one definition of a signed-in person.
 *
 * The role is re-read from the database rather than taken from the
 * token, for the same reason claimsForUser does it: a token minted
 * sixty days ago should not still grant a role the account has since
 * lost.
 */
export async function GET() {
  try {
    const session = await requireSession();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });
    // The token is valid but the account is gone. 401 rather than 404:
    // from the app's side this is simply a session that no longer
    // stands for anybody, and it should sign out.
    if (!user) return err("غير مصرح", 401);

    // Null when the account vanished between the two reads. Same
    // answer as a missing user: the session stands for nobody.
    const claims = await claimsForUser(user.id);
    if (!claims) return err("غير مصرح", 401);

    // Response.json rather than ok(), which takes no headers: roles
    // decide which screens open, and a cached answer could keep
    // somebody in a space they no longer belong to.
    return Response.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        businessId: claims.businessId,
        adminRole: claims.adminRole,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[mobile me]", e);
    return err("حدث خطأ", 500);
  }
}
