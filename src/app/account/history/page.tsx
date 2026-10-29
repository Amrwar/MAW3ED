import { getLang } from "@/lib/lang-server";
import type { Metadata } from "next";
import Link from "@/components/shared/LocaleLink";
import { History } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { decodeHistoryCursor, getAccountUser, getHistory } from "@/lib/account/queries";
import { translations } from "@/lib/i18n";
import { redirect } from "next/navigation";
import AccountBookingCard from "../_components/AccountBookingCard";

const PER_PAGE = 20;

export const metadata: Metadata = { title: "سجل الحجوزات", robots: { index: false, follow: false } };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await getAccountUser();
  if (!user) return null;

  const lang = await getLang();
  const t = translations[lang] ?? translations.ar;

  // Paged by keyset cursor (lib/account/queries getHistory), so a
  // booking that moves into history while somebody is paging does not
  // shift the next page into a repeat. A cursor that does not decode is
  // treated as the start.
  const raw = (await searchParams).cursor;
  const cursor = raw && decodeHistoryCursor(raw) ? raw : null;
  const { bookings, total, nextCursor } = await getHistory(user.phone, { take: PER_PAGE, cursor, since: user.historySince });
  // Past the end (or a stale link): back to the first page, not an
  // "empty history" that is not true.
  if (cursor && bookings.length === 0) redirect("/account/history");

  if (bookings.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<History size={24} strokeWidth={1.7} />}
          title={t.account.emptyHistory}
          body={t.account.emptyHistoryBody}
          action={
            <Link href="/businesses" className="btn btn-primary btn-sm">
              {t.account.browse}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="m-0 list-none space-y-4 p-0">
        {bookings.map((b) => (
          <li key={b.id}>
            <AccountBookingCard booking={b} variant="past" />
          </li>
        ))}
      </ul>
      {(cursor || nextCursor) && (
        <nav aria-label={t.businesses.pagination} className="flex flex-wrap items-center justify-center gap-3">
          {cursor && (
            <Link href="/account/history" className="btn btn-outline btn-sm min-h-11">
              {lang === "en" ? "Latest" : "الأحدث"}
            </Link>
          )}
          <span className="num text-[0.8125rem] text-[var(--color-muted)]">
            {lang === "en" ? `${total} bookings` : `${total} حجز`}
          </span>
          {nextCursor && (
            <Link href={`/account/history?cursor=${encodeURIComponent(nextCursor)}`} rel="next" className="btn btn-outline btn-sm min-h-11">
              {lang === "en" ? "Older" : "الأقدم"}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
