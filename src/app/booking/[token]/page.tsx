import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Clock, XCircle, AlertCircle,
  CalendarDays, Phone, Store,
} from "lucide-react";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import CancelButton from "./_components/CancelButton";
import RescheduleFlow from "./_components/RescheduleFlow";

type Params = { params: Promise<{ token: string }> };

const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDateAr(date: Date): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  const dow = new Date(Date.UTC(y, m, d, 12)).getDay();
  return `${AR_DAYS[dow]}، ${d} ${AR_MONTHS[m]} ${y}`;
}

const STATUS_CONFIG = {
  PENDING:   { label: "في الانتظار",  icon: Clock,        color: "text-amber-500",  bg: "bg-amber-50",  border: "border-amber-200" },
  CONFIRMED: { label: "مؤكد",         icon: CheckCircle,  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
  COMPLETED: { label: "مكتمل",        icon: CheckCircle,  color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200"  },
  CANCELLED: { label: "ملغي",         icon: XCircle,      color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200"   },
  NO_SHOW:   { label: "لم يحضر",      icon: AlertCircle,  color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200"  },
} as const;

const CUTOFF_HOURS = 2;

function canCancel(status: string, date: Date, startTime: string): boolean {
  if (!["PENDING", "CONFIRMED"].includes(status)) return false;
  const [h, m] = startTime.split(":").map(Number);
  const appt = new Date(date);
  appt.setUTCHours(h, m, 0, 0);
  return appt > new Date(Date.now() + CUTOFF_HOURS * 60 * 60 * 1000);
}

export default async function BookingPage({ params }: Params) {
  const { token } = await params;

  const booking = await db.booking.findUnique({
    where:   { accessToken: token },
    include: {
      business: { select: { nameAr: true, slug: true, phone: true } },
      service:  { select: { id: true, nameAr: true } },
    },
  });

  if (!booking) notFound();

  const status     = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = status.icon;
  const cancellable    = canCancel(booking.status, booking.date, booking.startTime);
  const reschedulable  = cancellable; // same eligibility rules

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir="rtl">
      {/* Navbar */}
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <Link href="/">
            <Logo size="sm" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Status card */}
        <div className={`rounded-2xl border p-5 flex items-center gap-4 ${status.bg} ${status.border}`}>
          <StatusIcon size={28} className={status.color} />
          <div>
            <p className={`font-black text-lg ${status.color}`}>{status.label}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {booking.status === "PENDING"   && "حجزك قيد المراجعة، سيتواصل معك الفريق قريبًا"}
              {booking.status === "CONFIRMED" && "حجزك مؤكد، نراك قريبًا!"}
              {booking.status === "COMPLETED" && "شكرًا لزيارتك"}
              {booking.status === "CANCELLED" && "تم إلغاء هذا الحجز"}
              {booking.status === "NO_SHOW"   && "لم يتم الحضور في هذا الموعد"}
            </p>
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              تفاصيل الحجز
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5" dir="ltr">
              #{booking.id.slice(-8).toUpperCase()}
            </p>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            <Row icon={<Store size={15} />}      label="المنشأة"  value={booking.business.nameAr} />
            <Row icon={<Clock size={15} />}       label="الخدمة"   value={booking.service.nameAr} />
            <Row icon={<CalendarDays size={15} />} label="التاريخ" value={formatDateAr(booking.date)} />
            <Row
              icon={<Clock size={15} />}
              label="الوقت"
              value={booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime}
              ltr
            />
            <Row icon={<Phone size={15} />} label="الهاتف" value={booking.customerPhone} ltr />
          </div>
        </div>

        {/* Actions */}
        {(cancellable || reschedulable) && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              إدارة الحجز
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              يمكنك تعديل أو إلغاء الحجز حتى {CUTOFF_HOURS} ساعات قبل الموعد
            </p>

            {reschedulable && (
              <RescheduleFlow
                token={token}
                slug={booking.business.slug}
                serviceId={booking.service.id}
                currentDate={booking.date.toISOString().split("T")[0]}
                currentStart={booking.startTime}
                currentEnd={booking.endTime ?? booking.startTime}
                serviceName={booking.service.nameAr}
                businessName={booking.business.nameAr}
              />
            )}

            {cancellable && (
              <CancelButton token={token} onCancelled={() => window.location.reload()} />
            )}
          </div>
        )}

        {/* Business link */}
        <div className="text-center pt-2">
          <Link
            href={`/company/${booking.business.slug}`}
            className="text-sm text-[var(--color-brand)] hover:underline"
          >
            عرض صفحة {booking.business.nameAr}
          </Link>
        </div>
      </main>
    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────

function Row({
  icon, label, value, ltr = false,
}: {
  icon:   React.ReactNode;
  label:  string;
  value:  string;
  ltr?:   boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      <span className="text-sm text-[var(--color-text-muted)] w-20 shrink-0">{label}</span>
      <span
        className="text-sm font-semibold text-[var(--color-text-primary)] flex-1 text-end"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
