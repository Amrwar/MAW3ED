import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getAccountUser, getUpcoming } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";
import AccountBookingCard from "../_components/AccountBookingCard";

export const metadata: Metadata = { title: "مواعيدي الجاية", robots: { index: false, follow: false } };

export default async function UpcomingPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const upcoming = await getUpcoming(user.phone);

  if (upcoming.length === 0) {
    return (
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
    );
  }

  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {upcoming.map((b) => (
        <li key={b.id}>
          <AccountBookingCard booking={b} variant="upcoming" />
        </li>
      ))}
    </ul>
  );
}
