/**
 * /payment/return
 *
 * Paymob redirects customers here after the payment page.
 * Query params provided by Paymob include:
 *   success, pending, merchant_order_id (= our booking ID), order, id, ...
 *
 * We NEVER trust these params to confirm the booking — the webhook does that.
 * This page only reads the booking's current status from the DB and shows UI.
 * If the webhook hasn't fired yet we show a "verifying" state.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "نتيجة الدفع | موعد" };

// Force dynamic so query params are always fresh
export const dynamic = "force-dynamic";

interface SearchParams { [key: string]: string | string[] | undefined }

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // Paymob passes our booking ID as merchant_order_id
  const bookingId = typeof sp.merchant_order_id === "string" ? sp.merchant_order_id : null;
  const paymobSuccess = sp.success === "true";

  let booking = null;
  if (bookingId) {
    booking = await db.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:           true,
        status:       true,
        accessToken:  true,
        customerName: true,
        startTime:    true,
        endTime:      true,
        date:         true,
        service:      { select: { nameAr: true } },
        business:     { select: { nameAr: true, slug: true } },
        depositAmount: true,
        currency:      true,
      },
    });
  }

  // Determine display state from DB status (authoritative)
  const isConfirmed    = booking?.status === "CONFIRMED";
  const isFailed       = booking?.status === "FAILED_PAYMENT";
  const isPending      = booking?.status === "PENDING_PAYMENT";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── Confirmed ── */}
        {isConfirmed && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-2">
              تم الدفع وتأكيد الحجز!
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              تم استلام دفعتك وتأكيد حجزك. سيُرسَل إليك تذكير قبل الموعد.
            </p>

            <div className="bg-[var(--color-surface-2)] rounded-xl p-4 text-start space-y-2.5 mb-6">
              <Row label="العمل"    value={booking.business.nameAr} />
              <Row label="الخدمة"   value={booking.service.nameAr} />
              <Row label="التاريخ"  value={booking.date.toISOString().split("T")[0]} />
              <Row label="الوقت"    value={`${booking.startTime}${booking.endTime ? ` – ${booking.endTime}` : ""}`} ltr />
              {booking.depositAmount !== null && (
                <Row
                  label="العربون المدفوع"
                  value={`${Number(booking.depositAmount).toLocaleString("ar-EG")} ${booking.currency}`}
                  bold
                />
              )}
            </div>

            {booking.accessToken && (
              <Link
                href={`/booking/${booking.accessToken}`}
                className="block w-full text-center py-3 rounded-xl bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity mb-3"
              >
                عرض تفاصيل الحجز
              </Link>
            )}
            <Link
              href={`/company/${booking.business.slug}`}
              className="block w-full text-center py-2.5 rounded-xl border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
            >
              العودة إلى الصفحة الرئيسية
            </Link>
          </div>
        )}

        {/* ── Failed ── */}
        {isFailed && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-red-500" />
            </div>
            <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-2">
              فشلت عملية الدفع
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              لم يتم استكمال الدفع. الحجز لم يُؤكَّد. يمكنك المحاولة مرة أخرى.
            </p>
            {booking?.business?.slug && (
              <Link
                href={`/company/${booking.business.slug}`}
                className="flex items-center justify-center gap-2 w-full text-center py-3 rounded-xl bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <ArrowRight size={15} />
                حاول الحجز مجددًا
              </Link>
            )}
          </div>
        )}

        {/* ── Still pending (webhook not fired yet) ── */}
        {isPending && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={44} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-2">
              جارٍ التحقق من الدفع…
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {paymobSuccess
                ? "تم استلام الدفعة ونحن نتحقق منها. يرجى الانتظار لحظة."
                : "لم نتلقَّ تأكيد الدفع بعد. إن كنت قد أتممت الدفع، سيُؤكَّد الحجز خلال دقائق."}
            </p>
            {booking.accessToken && (
              <Link
                href={`/booking/${booking.accessToken}`}
                className="block w-full text-center py-3 rounded-xl bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                تحقق من حالة الحجز
              </Link>
            )}
          </div>
        )}

        {/* ── No booking found ── */}
        {!booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-gray-400" />
            </div>
            <h1 className="text-xl font-black text-[var(--color-text-primary)] mb-2">
              الحجز غير موجود
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              تعذّر العثور على تفاصيل الحجز. تحقق من رابط الحجز أو تواصل مع الدعم.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  ltr  = false,
  bold = false,
}: {
  label: string;
  value: string;
  ltr?:  boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-end ${bold ? "font-black text-[var(--color-accent)]" : "font-medium text-[var(--color-text-primary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}
