import { notFound } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import {
  CheckCircle, Clock, XCircle, AlertCircle,
  CalendarDays, Phone, Store, CreditCard,
} from "lucide-react";
import type { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import CancelButton from "./_components/CancelButton";
import RescheduleFlow from "./_components/RescheduleFlow";
import LeaveReview from "./_components/LeaveReview";
import AccessPanel from "./_components/AccessPanel";
import { canReviewBooking } from "@/lib/reviews";
import { customerMayCancel, customerMayChange } from "@/lib/bookings/self-service";
import { bookingMoney, toCents } from "@/lib/payments/money";
import { arCount, duration, money, clockRange } from "@/lib/fmt";

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

// Every BookingStatus needs an entry: a missing one is a 500 for that
// customer. The two payment states were missing, so a customer whose
// card failed — the person most likely to open this page — got an error.
const STATUS_CONFIG = {
  PENDING_PAYMENT: { label: "بانتظار الدفع", icon: CreditCard, color: "text-[var(--color-star)]", bg: "bg-[var(--color-warn-soft)]", border: "border-[var(--color-warn-line)]" },
  FAILED_PAYMENT:  { label: "لم يكتمل الدفع", icon: XCircle,   color: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger-soft)]", border: "border-[var(--color-danger-line)]" },
  PENDING:     { label: "في الانتظار",  icon: Clock,        color: "text-[var(--color-star)]",  bg: "bg-[var(--color-warn-soft)]",  border: "border-[var(--color-warn-line)]" },
  CONFIRMED:   { label: "مؤكد",         icon: CheckCircle,  color: "text-[var(--color-ok)]",  bg: "bg-[var(--color-ok-soft)]",  border: "border-[var(--color-ok-line)]" },
  ARRIVED:     { label: "وصلت",         icon: CheckCircle,  color: "text-[var(--color-jade)]", bg: "bg-[var(--color-jade-soft)]", border: "border-[var(--color-jade-line)]" },
  IN_PROGRESS: { label: "جاري التنفيذ", icon: Clock,        color: "text-[var(--color-info)]", bg: "bg-[var(--color-info-soft)]", border: "border-[var(--color-info-line)]" },
  COMPLETED: { label: "مكتمل",        icon: CheckCircle,  color: "text-[var(--color-jade)]",   bg: "bg-[var(--color-jade-soft)]",   border: "border-[var(--color-jade-line)]"  },
  CANCELLED: { label: "ملغي",         icon: XCircle,      color: "text-[var(--color-danger)]",    bg: "bg-[var(--color-danger-soft)]",    border: "border-[var(--color-danger-line)]"   },
  NO_SHOW:   { label: "محضرتش",      icon: AlertCircle,  color: "text-[var(--color-subtle)]",   bg: "bg-[var(--color-surface-2)]",   border: "border-[var(--color-line)]"  },
} satisfies Record<BookingStatus, unknown>;

export default async function BookingPage({ params }: Params) {
  const { token } = await params;

  const booking = await db.booking.findUnique({
    where:   { accessToken: token },
    include: {
      business:    { select: { nameAr: true, slug: true, phone: true, cancellationCutoffHours: true } },
      service:     { select: { id: true, nameAr: true, duration: true } },
      staffMember: { select: { nameAr: true } },
      branch:      { select: { nameAr: true } },
      review:      { select: { id: true } },
      payments:    {
        where:  { kind: { not: "SUBSCRIPTION" } },
        select: { status: true, amountCents: true, refundedCents: true },
      },
    },
  });

  if (!booking) notFound();

  const status     = STATUS_CONFIG[booking.status];
  const StatusIcon = status.icon;
  // A booking still waiting on its deposit can be cancelled (it lets go
  // of the slot) but not moved.
  const cutoffHours    = booking.business.cancellationCutoffHours;
  const cancellable    = customerMayCancel(booking, undefined, cutoffHours);
  const reschedulable  = customerMayChange(booking, undefined, cutoffHours);
  // Every payment against it, less refunds — the same figures the app
  // shows (lib/bookings/public-view.ts).
  const ledger         = bookingMoney(toCents(booking.totalPrice), booking.payments);
  const hasMoney       = ledger.paidCents > 0;
  // Only a completed appointment, and only once. The API checks this
  // again, so a page left open cannot post a second review.
  const canReview      = canReviewBooking(booking).allowed;

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir="rtl">
      {/* Navbar */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-line)]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <Logo size="sm" />
        </div>
      </header>

      <main id="main" className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* The account pages link to #review, #reschedule and #cancel. */}
        {canReview && (
          <div id="review" className="scroll-mt-4">
            <LeaveReview token={token} businessName={booking.business.nameAr} />
          </div>
        )}

        {/* Status card */}
        <div className={`rounded-[var(--radius-lg)] border p-5 flex items-center gap-4 ${status.bg} ${status.border}`}>
          <StatusIcon size={28} className={status.color} />
          <div>
            <p className={`font-extrabold text-lg ${status.color}`}>{status.label}</p>
            <p className="text-sm text-[var(--color-muted)]">
              {booking.status === "PENDING_PAYMENT" && "الموعد محجوز لك لحين إتمام الدفع"}
              {booking.status === "FAILED_PAYMENT"  && "لم يكتمل الدفع، ولم يتم تأكيد الموعد. يمكنك الحجز من جديد."}
              {booking.status === "PENDING"     && `حجزك مستني تأكيد من ${booking.business.nameAr}، وهيوصلك إشعار لما يتأكد`}
              {booking.status === "CONFIRMED"   && "حجزك مؤكد، المكان مستنيك!"}
              {booking.status === "ARRIVED"     && "سجّلنا وصولك، استنى شوية"}
              {booking.status === "IN_PROGRESS" && "الخدمة شغالة دلوقتي"}
              {booking.status === "COMPLETED" && "شكرًا لزيارتك"}
              {booking.status === "CANCELLED" && "تم إلغاء هذا الحجز"}
              {booking.status === "NO_SHOW"   && "مجيتش في الميعاد ده"}
            </p>
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] bg-[var(--color-surface-2)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              تفاصيل الحجز
            </p>
            {/* The reference, not a slice of the internal id. This is
                what a customer reads down the phone and what support
                searches on. */}
            <p className="num mt-1 text-[0.9375rem] font-extrabold tracking-wide text-[var(--color-ink)]" dir="ltr">
              {booking.reference ?? booking.id.slice(-8).toUpperCase()}
            </p>
          </div>

          <div className="divide-y divide-[var(--color-line)]">
            <Row icon={<Store size={15} />}      label="المكان"    value={booking.business.nameAr} />
            <Row icon={<Clock size={15} />}       label="الخدمة"   value={booking.service.nameAr} />
            <Row icon={<CalendarDays size={15} />} label="التاريخ" value={formatDateAr(booking.date)} />
            <Row
              icon={<Clock size={15} />}
              label="الوقت"
              value={clockRange(booking.startTime, booking.endTime)}
              ltr
            />
            <Row
              icon={<Clock size={15} />}
              label="المدة"
              value={duration(booking.service.duration, "ar")}
            />
            {booking.staffMember && (
              <Row icon={<Store size={15} />} label="مقدّم الخدمة" value={booking.staffMember.nameAr} />
            )}
            {booking.branch && (
              <Row icon={<Store size={15} />} label="الفرع" value={booking.branch.nameAr} />
            )}
            <Row icon={<Phone size={15} />} label="الهاتف" value={booking.customerPhone} ltr />
            <Row
              icon={<Store size={15} />}
              label="السعر"
              value={
                Number(booking.totalPrice) > 0
                  ? money(Number(booking.totalPrice), "ar", booking.currency)
                  : "السعر غير محدد"
              }
            />
            {booking.depositAmount !== null && Number(booking.depositAmount) > 0 && (
              <Row
                icon={<Store size={15} />}
                label="العربون المطلوب"
                value={money(Number(booking.depositAmount), "ar", booking.currency)}
              />
            )}
            {hasMoney && (
              <Row
                icon={<CreditCard size={15} />}
                label="المدفوع"
                value={money(ledger.netPaidCents / 100, "ar", booking.currency)}
              />
            )}
            {ledger.refundedCents > 0 && (
              <Row
                icon={<CreditCard size={15} />}
                label="اترجّع"
                value={money(ledger.refundedCents / 100, "ar", booking.currency)}
              />
            )}
            {hasMoney && Number(booking.totalPrice) > 0 && (
              <Row
                icon={<CreditCard size={15} />}
                label="الباقي في المكان"
                value={ledger.outstandingCents === 0 ? "مدفوع بالكامل" : money(ledger.outstandingCents / 100, "ar", booking.currency)}
              />
            )}
          </div>
        </div>

        {/* Getting in: the booking's check-in QR, and a venue's visitor
            passes where it offers them (Phase 23). */}
        {["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(booking.status) && (
          <AccessPanel token={token} customerName={booking.customerName} />
        )}

        {/* Add to calendar — a plain .ics, which every calendar opens
            and which sends the appointment to nobody. */}
        {["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(booking.status) && (
          <a
            href={`/api/public/booking/${token}/calendar`}
            className="btn btn-outline w-full"
            download
          >
            <CalendarDays size={16} strokeWidth={1.9} aria-hidden="true" />
            ضيف الميعاد للتقويم
          </a>
        )}

        {/* Rebook — only once the visit is over, and pre-selecting the
            service they had rather than starting from a blank page. */}
        {["COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"].includes(booking.status) && (
          <Link
            href={`/company/${booking.business.slug}?service=${booking.serviceId}#booking`}
            className="btn btn-primary w-full"
          >
            احجز مرة تانية
          </Link>
        )}

        {/* Actions */}
        {(cancellable || reschedulable) && (
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              إدارة الحجز
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {/* The rule the cancel and reschedule routes enforce. Nothing
                  refunds a deposit automatically, so nothing promises it. */}
              تقدر تلغي أو تغيّر ميعاد الحجز لحد {arCount(cutoffHours, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" })} قبل الميعاد.
              {booking.depositAmount !== null && Number(booking.depositAmount) > 0
                ? " العربون مش بيترجع تلقائيًا لو لغيت، كلّم المكان بخصوصه."
                : ""}
            </p>

            {reschedulable && (
              <div id="reschedule" className="scroll-mt-4">
              <RescheduleFlow
                token={token}
                currentDate={booking.date.toISOString().split("T")[0]}
                currentStart={booking.startTime}
                currentEnd={booking.endTime ?? booking.startTime}
              />
              </div>
            )}

            {cancellable && (
              <div id="cancel" className="scroll-mt-4">
                <CancelButton token={token} />
              </div>
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
