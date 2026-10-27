import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { hashSecret } from "@/lib/verification";
import { siteUrl } from "@/lib/url";

/**
 * GET /api/public/waitlist/confirm?token=…
 *
 * The link in the waitlist email. Confirms the request and sends the
 * visitor to /waitlist, which says how it went. The token works once.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  let status: "ok" | "invalid" = "invalid";
  let lang = "ar";

  if (/^[a-f0-9]{64}$/.test(token)) {
    try {
      const row = await db.waitlistRequest.findUnique({
        where: { confirmToken: hashSecret(token) },
        select: { id: true, lang: true },
      });
      if (row) {
        await db.waitlistRequest.update({
          where: { id: row.id },
          data: { confirmedAt: new Date(), confirmToken: null },
        });
        status = "ok";
        lang = row.lang;
      }
    } catch (e) {
      log.error("[waitlist confirm]", e);
    }
  }

  return NextResponse.redirect(siteUrl(`${lang === "en" ? "/en" : ""}/waitlist?status=${status}`), 303);
}
