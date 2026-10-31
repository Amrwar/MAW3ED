import Link from "@/components/shared/LocaleLink";
import { db } from "@/lib/db";
import { getLang } from "@/lib/lang-server";
import { bookingScope, can, type BusinessActor } from "@/lib/business-access";
import { cairoWallDay } from "@/lib/bookings/instants";
import { SCOPE_LABELS } from "@/lib/organizations/delegation";

/**
 * The dashboard home of someone operating a business for an organization.
 * Not the owner's overview — that one leads with revenue, the plan and
 * the setup checklist. This is the delegate's day: what is waiting, what
 * is on today, and the areas the business granted, each a working link.
 */
export default async function DelegateHome({ business, actor }: { business: { id: string; nameAr: string; nameEn: string | null }; actor: BusinessActor }) {
  const lang = await getLang();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const seesBookings = can(actor, "bookings.read");
  const { start, end } = cairoWallDay(new Date());
  const scope = bookingScope(business, actor);
  const [pending, today] = seesBookings
    ? await Promise.all([
        db.booking.count({ where: { ...scope, status: "PENDING", isTest: false } }),
        db.booking.count({ where: { ...scope, isTest: false, startsAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "FAILED_PAYMENT"] } } }),
      ])
    : [0, 0];

  const areas: { href: string; label: string; show: boolean }[] = [
    { href: "/dashboard/bookings", label: t("الحجوزات", "Bookings"), show: seesBookings },
    { href: "/dashboard/calendar", label: t("التقويم", "Calendar"), show: seesBookings },
    { href: "/dashboard/customers", label: t("العملاء", "Customers"), show: can(actor, "customers.read") },
    { href: "/dashboard/services", label: t("الخدمات", "Services"), show: can(actor, "services.manage") },
    { href: "/dashboard/staff", label: t("الفريق", "Staff"), show: can(actor, "staff.manage") },
    { href: "/dashboard/settings", label: t("بيانات النشاط", "Business profile"), show: can(actor, "profile.manage") },
    { href: "/dashboard/settings?tab=availability", label: t("ساعات العمل", "Opening hours"), show: can(actor, "schedule.manage") },
    { href: "/dashboard/reports", label: t("التقارير", "Reports"), show: can(actor, "reports.read") },
  ];
  const name = (en ? business.nameEn : null) || business.nameAr;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="m-0 text-2xl font-black">{name}</h1>
        <p className="m-0 mt-1 text-sm text-[var(--color-subtle)]">
          {t("الحاجات اللي صاحب النشاط سمح للجهة تديرها:", "What the business owner allowed the organization to manage:")}{" "}
          {(actor.delegation?.scopes ?? []).map((s) => (en ? SCOPE_LABELS[s][1] : SCOPE_LABELS[s][0])).join(en ? ", " : "، ")}
        </p>
      </header>

      {seesBookings && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/bookings?status=PENDING" className="card block p-5">
            <span className="block text-xs text-[var(--color-subtle)]">{t("مستني تأكيد", "Waiting for confirmation")}</span>
            <span className="num block text-3xl font-black">{pending}</span>
          </Link>
          <Link href="/dashboard/bookings/today" className="card block p-5">
            <span className="block text-xs text-[var(--color-subtle)]">{t("مواعيد النهارده", "Today")}</span>
            <span className="num block text-3xl font-black">{today}</span>
          </Link>
        </div>
      )}

      <nav aria-label={t("الأقسام المسموحة", "Allowed areas")} className="card p-5">
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {areas.filter((a) => a.show).map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="btn btn-outline w-full justify-start">{a.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
