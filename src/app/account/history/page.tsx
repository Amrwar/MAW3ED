import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountUser, getHistory } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";
import AccountBookingCard from "../_components/AccountBookingCard";
import LinkPager from "@/components/ui/LinkPager";

const PER_PAGE = 20;

export const metadata: Metadata = { title: "سجل الحجوزات", robots: { index: false, follow: false } };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  // Any page number that is not a positive integer is page 1; one past
  // the end shows the last page rather than an empty list.
  const raw = Number((await searchParams).page);
  const requested = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 10_000) : 1;
  let { bookings, total } = await getHistory(user.phone, { take: PER_PAGE, skip: (requested - 1) * PER_PAGE });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(requested, totalPages);
  if (page !== requested) {
    ({ bookings, total } = await getHistory(user.phone, { take: PER_PAGE, skip: (page - 1) * PER_PAGE }));
  }

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
      <LinkPager
        page={page}
        totalPages={totalPages}
        basePath="/account/history"
        labels={{
          previous: t.businesses.previous,
          next: t.businesses.next,
          page: t.businesses.page,
          of: lang === "en" ? "of" : "من",
          nav: t.businesses.pagination,
        }}
      />
    </div>
  );
}
