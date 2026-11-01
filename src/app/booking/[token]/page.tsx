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
import { countIn, duration, money, clockRange } from "@/lib/fmt";
import { getLang } from "@/lib/lang-server";
import { localName } from "@/lib/lang";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ token: string }> };

const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

// The booking's date is a calendar day stored at UTC midnight: read in UTC.
function formatDate(date: Date, lang: Lang): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  if (lang === "en") {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  }
  const dow = new Date(Date.UTC(y, m, d, 12)).getDay();
  return `${AR_DAYS[dow]}، ${d} ${AR_MONTHS[m]} ${y}`;
}

// Every BookingStatus needs an entry: a missing one is a 500 for that
// customer. The two payment states were missing, so a customer whose
// card failed — the person most likely to open this page — got an error.
const STATUS_CONFIG = {
  PENDING_PAYMENT: { label: "بانتظار الدفع", labelEn: "Pending Payment", icon: CreditCard, color: "text-[var(--color-star)]", bg: "bg-[var(--color-warn-soft)]", border: "border-[var(--color-warn-line)]" },
  FAILED_PAYMENT:  { label: "لم يكتمل الدفع", labelEn: "Payment Failed", icon: XCircle,   color: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger-soft)]", border: "border-[var(--color-danger-line)]" },
  PENDING:     { label: "في الانتظار", labelEn: "Pending",  icon: Clock,        color: "text-[var(--color-star)]",  bg: "bg-[var(--color-warn-soft)]",  border: "border-[var(--color-warn-line)]" },
  CONFIRMED:   { label: "مؤكد", labelEn: "Confirmed",         icon: CheckCircle,  color: "text-[var(--color-ok)]",  bg: "bg-[var(--color-ok-soft)]",  border: "border-[var(--color-ok-line)]" },
  ARRIVED:     { label: "وصلت", labelEn: "Arrived",         icon: CheckCircle,  color: "text-[var(--color-jade)]", bg: "bg-[var(--color-jade-soft)]", border: "border-[var(--color-jade-line)]" },
  IN_PROGRESS: { label: "جاري التنفيذ", labelEn: "In progress", icon: Clock,        color: "text-[var(--color-info)]", bg: "bg-[var(--color-info-soft)]", border: "border-[var(--color-info-line)]" },
  COMPLETED: { label: "مكتمل", labelEn: "Completed",        icon: CheckCircle,  color: "text-[var(--color-jade)]",   bg: "bg-[var(--color-jade-soft)]",   border: "border-[var(--color-jade-line)]"  },
  CANCELLED: { label: "ملغي", labelEn: "Cancelled",         icon: XCircle,      color: "text-[var(--color-danger)]",    bg: "bg-[var(--color-danger-soft)]",    border: "border-[var(--color-danger-line)]"   },
  NO_SHOW:   { label: "محضرتش", labelEn: "No Show",      icon: AlertCircle,  color: "text-[var(--color-subtle)]",   bg: "bg-[var(--color-surface-2)]",   border: "border-[var(--color-line)]"  },
} satisfies Record<BookingStatus, unknown>;

export default async function BookingPage({ params }: Params) {
  const { token } = await params;

  const booking = await db.booking.findUnique({
    where:   { accessToken: token },
    include: {
      business:    { select: { nameAr: true, nameEn: true, slug: true, phone: true, cancellationCutoffHours: true } },
      service:     { select: { id: true, nameAr: true, nameEn: true, duration: true } },
      staffMember: { select: { nameAr: true, nameEn: true } },
      branch:      { select: { nameAr: true, nameEn: true } },
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

  const lang         = await getLang();
  const en           = lang === "en";
  const say          = (ar: string, english: string) => (en ? english : ar);
  const businessName = localName(en, booking.business.nameAr, booking.business.nameEn);
  const cutoff       = countIn(lang, cutoffHours, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" }, { one: "hour" });

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]" dir={en ? "ltr" : "rtl"}>
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
            <LeaveReview token={token} businessName={businessName} />
          </div>
        )}

        {/* Status card */}
        <div className={`rounded-[var(--radius-lg)] border p-5 flex items-center gap-4 ${status.bg} ${status.border}`}>
          <StatusIcon size={28} className={status.color} />
          <div>
            <p className={`font-extrabold text-lg ${status.color}`}>{en ? status.labelEn : status.label}</p>
            <p className="text-sm text-[var(--color-muted)]">
              {booking.status === "PENDING_PAYMENT" && say("الموعد محجوز لك لحين إتمام الدفع", "Your time is held for you until payment is complete.")}
              {booking.status === "FAILED_PAYMENT"  && say("لم يكتمل الدفع، ولم يتم تأكيد الموعد. يمكنك الحجز من جديد.", "Payment didn't go through, so the appointment isn't confirmed. You can book again.")}
              {booking.status === "PENDING"     && say(`حجزك مستني تأكيد من ${businessName}، وهيوصلك إشعار لما يتأكد`, `Your booking is waiting for ${businessName} to confirm it. We'll let you know when they do.`)}
              {booking.status === "CONFIRMED"   && say("حجزك مؤكد، المكان مستنيك!", "Your booking is confirmed. See you there!")}
              {booking.status === "ARRIVED"     && say("سجّلنا وصولك، استنى شوية", "You're checked in. Please wait a moment.")}
              {booking.status === "IN_PROGRESS" && say("الخدمة شغالة دلوقتي", "Your service is under way.")}
              {booking.status === "COMPLETED" && say("شكرًا لزيارتك", "Thanks for your visit.")}
              {booking.status === "CANCELLED" && say("تم إلغاء هذا الحجز", "This booking was cancelled.")}
              {booking.status === "NO_SHOW"   && say("مجيتش في الميعاد ده", "You didn't come to this appointment.")}
            </p>
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] bg-[var(--color-surface-2)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              {say("تفاصيل الحجز", "Booking details")}
            </p>
            {/* The reference, not a slice of the internal id. This is
                what a customer reads down the phone and what support
                searches on. */}
            <p className="num mt-1 text-[0.9375rem] font-extrabold tracking-wide text-[var(--color-ink)]" dir="ltr">
              {booking.reference ?? booking.id.slice(-8).toUpperCase()}
            </p>
          </div>

          <div className="divide-y divide-[var(--color-line)]">
            <Row icon={<Store size={15} />}      label={say("المكان", "Place")}    value={businessName} />
            <Row icon={<Clock size={15} />}       label={say("الخدمة", "Service")}   value={localName(en, booking.service.nameAr, booking.service.nameEn)} />
            <Row icon={<CalendarDays size={15} />} label={say("التاريخ", "Date")} value={formatDate(booking.date, lang)} />
            <Row
              icon={<Clock size={15} />}
              label={say("الوقت", "Time")}
              value={clockRange(booking.startTime, booking.endTime)}
              ltr
            />
            <Row
              icon={<Clock size={15} />}
              label={say("المدة", "Duration")}
              value={duration(booking.service.duration, lang)}
            />
            {booking.staffMember && (
              <Row icon={<Store size={15} />} label={say("مقدّم الخدمة", "With")} value={localName(en, booking.staffMember.nameAr, booking.staffMember.nameEn)} />
            )}
            {booking.branch && (
              <Row icon={<Store size={15} />} label={say("الفرع", "Branch")} value={localName(en, booking.branch.nameAr, booking.branch.nameEn)} />
            )}
            <Row icon={<Phone size={15} />} label={say("الهاتف", "Phone")} value={booking.customerPhone} ltr />
            <Row
              icon={<Store size={15} />}
              label={say("السعر", "Price")}
              value={
                Number(booking.totalPrice) > 0
                  ? money(Number(booking.totalPrice), lang, booking.currency)
                  : say("السعر غير محدد", "Price not set")
              }
            />
            {booking.depositAmount !== null && Number(booking.depositAmount) > 0 && (
              <Row
                icon={<Store size={15} />}
                label={say("العربون المطلوب", "Deposit")}
                value={money(Number(booking.depositAmount), lang, booking.currency)}
              />
            )}
            {hasMoney && (
              <Row
                icon={<CreditCard size={15} />}
                label={say("المدفوع", "Paid")}
                value={money(ledger.netPaidCents / 100, lang, booking.currency)}
              />
            )}
            {ledger.refundedCents > 0 && (
              <Row
                icon={<CreditCard size={15} />}
                label={say("اترجّع", "Refunded")}
                value={money(ledger.refundedCents / 100, lang, booking.currency)}
              />
            )}
            {hasMoney && Number(booking.totalPrice) > 0 && (
              <Row
                icon={<CreditCard size={15} />}
                label={say("الباقي في المكان", "Left to pay there")}
                value={ledger.outstandingCents === 0 ? say("مدفوع بالكامل", "Paid in full") : money(ledger.outstandingCents / 100, lang, booking.currency)}
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
            {say("ضيف الميعاد للتقويم", "Add to calendar")}
          </a>
        )}

        {/* Rebook — only once the visit is over, and pre-selecting the
            service they had rather than starting from a blank page. */}
        {["COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"].includes(booking.status) && (
          <Link
            href={`/company/${booking.business.slug}?service=${booking.serviceId}#booking`}
            className="btn btn-primary w-full"
          >
            {say("احجز مرة تانية", "Book again")}
          </Link>
        )}

        {/* Actions */}
        {(cancellable || reschedulable) && (
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {say("إدارة الحجز", "Manage booking")}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {/* The rule the cancel and reschedule routes enforce. Nothing
                  refunds a deposit automatically, so nothing promises it. */}
              {say(`تقدر تلغي أو تغيّر ميعاد الحجز لحد ${cutoff} قبل الميعاد.`, `You can cancel or change this booking up to ${cutoff} before it.`)}
              {booking.depositAmount !== null && Number(booking.depositAmount) > 0
                ? say(" العربون مش بيترجع تلقائيًا لو لغيت، كلّم المكان بخصوصه.", " A deposit isn't refunded automatically if you cancel; contact the place about it.")
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
            {say(`عرض صفحة ${businessName}`, `View ${businessName}'s page`)}
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
