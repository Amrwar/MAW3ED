import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLang } from "@/lib/lang-server";
import { safeNext } from "@/lib/account/safe-next";
import PhoneLogin from "./_components/PhoneLogin";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Customer sign in" : "الدخول لحسابك",
    description: en
      ? "Sign in to Maw3ed to see your bookings and saved places."
      : "ادخل على حسابك في موعد عشان تشوف حجوزاتك ومحفوظاتك.",
    robots: { index: false, follow: true },
  };
}

/**
 * Somebody already signed in goes where they were heading. Besides
 * sparing them a form, it keeps the Google button away from a browser
 * with a session in it: NextAuth would link the Google account to that
 * session's user (lib/auth/google-signin.ts refuses it as well). An
 * account without a phone lands on the account area's "add your number"
 * step, which is what signing in here with a phone would have given.
 *
 * auth() re-checks the account, so a revoked session sees the form and
 * nothing loops (the same reasoning as lib/auth/signed-in-home.ts).
 */
export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    const next = (await searchParams).next;
    redirect(safeNext(typeof next === "string" ? next : null));
  }
  return <PhoneLogin />;
}
