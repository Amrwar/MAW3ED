import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountSummary, getAccountUser, getUpcoming } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";
import AccountBookingCard from "./_components/AccountBookingCard";
import SummaryTiles from "./_components/SummaryTiles";

export const metadata: Metadata = { title: "حسابي", robots: { index: false, follow: false } };

export default async function AccountOverviewPage() {
  const user = await getAccountUser();
  if (!user) return null; // the layout has already explained why

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const [summary, upcoming] = await Promise.all([
    getAccountSummary(user.id, user.phone),
    getUpcoming(user.phone),
  ]);

  return (
    <div className="space-y-6">
      <SummaryTiles summary={summary} />

      <section>
        <h2 className="m-0 mb-4 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          {t.account.nav.upcoming}
        </h2>

        {upcoming.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CalendarClock size={24} strokeWidth={1.7} />}
              title={t.account.emptyUpcoming}
              body={t.account.emptyUpcomingBody}
              action={
                <Link href="/businesses" className="btn btn-primary btn-sm">
                  {t.account.browse}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="m-0 list-none space-y-4 p-0">
            {/* The next three; the rest live on their own page. */}
            {upcoming.slice(0, 3).map((b) => (
              <li key={b.id}>
                <AccountBookingCard booking={b} variant="upcoming" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
