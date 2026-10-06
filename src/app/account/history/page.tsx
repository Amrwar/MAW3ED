import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountUser, getHistory } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";
import AccountBookingCard from "../_components/AccountBookingCard";

export const metadata: Metadata = { title: "سجل الحجوزات", robots: { index: false, follow: false } };

export default async function HistoryPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const { bookings } = await getHistory(user.phone, { take: 30 });

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
    <ul className="m-0 list-none space-y-4 p-0">
      {bookings.map((b) => (
        <li key={b.id}>
          <AccountBookingCard booking={b} variant="past" />
        </li>
      ))}
    </ul>
  );
}
