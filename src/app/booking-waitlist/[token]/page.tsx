import type { Metadata } from "next";
import Logo from "@/components/shared/Logo";
import { getLang } from "@/lib/lang-server";
import WaitlistEntry from "./WaitlistEntry";

type Params = { params: Promise<{ token: string }> };

// A link only its holder has: never indexed, never followed.
export const metadata: Metadata = {
  title: "قائمة الانتظار",
  robots: { index: false, follow: false },
};

/**
 * The customer's own waitlist link, as sent by email and to their
 * account. What it stands at is read from the same public endpoint the
 * page then acts on, so there is one place that decides whether an offer
 * is still live.
 */
export default async function BookingWaitlistPage({ params }: Params) {
  const { token } = await params;
  const lang = await getLang();
  const en = lang === "en";

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir={en ? "ltr" : "rtl"}>
      <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <Logo size="sm" />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <WaitlistEntry token={token} />
      </main>
    </div>
  );
}
