/**
 * GET /ref/[code]
 *
 * Validates the referral code, sets a short-lived cookie, and redirects the
 * visitor to /signup so the onboarding flow can attach the referral.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const base = process.env.NEXTAUTH_URL ?? "https://www.maw3ed.net";

  // Validate code exists
  const referrer = await db.business.findUnique({
    where:  { referralCode: upperCode },
    select: { id: true },
  });

  const dest = new URL("/signup", base);

  if (!referrer) {
    // Unknown code — still redirect, just without cookie
    return NextResponse.redirect(dest);
  }

  const response = NextResponse.redirect(dest);

  response.cookies.set("maw3ed_ref", upperCode, {
    httpOnly: true,
    path:     "/",
    maxAge:   60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
  });

  return response;
}
