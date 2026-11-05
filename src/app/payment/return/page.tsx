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
import { redirect } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { db } from "@/lib/db";
import { bookingIdFromMerchantOrderId } from "@/lib/services/paymob";
import { CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import BackToApp from "./BackToApp";
import { clockRange } from "@/lib/fmt";
import { getLang } from "@/lib/lang-server";
import { localName } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "en" ? "Payment result" : "نتيجة الدفع", robots: { index: false, follow: false } };
}

// Force dynamic so query params are always fresh
export const dynamic = "force-dynamic";

interface SearchParams { [key: string]: string | string[] | undefined }

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const en = (await getLang()) === "en";
  // Paymob passes our booking ID as merchant_order_id
  const merchantOrderId = typeof sp.merchant_order_id === "string" ? sp.merchant_order_id : null;

  // ── Subscriptions land here too ─────────────────────────────
  //
  // The return URL is a single setting in the Paymob dashboard, and
  // nothing in the code can vary it per payment — getPaymentKey sends
  // no return_url. So every payment comes back to whichever page that
  // setting names, including subscription upgrades, which have no
  // booking at all.
  //
  // Their merchant_order_id is "sub_{businessId}_{plan}_{timestamp}",
  // and feeding that to booking.findUnique finds nothing, so an owner
  // who had just paid was shown "الحجز غير موجود" — a booking they
  // never made, missing. It said that whether the payment had
  // succeeded or failed, which made a success look like a failure.
  //
  // The query string is carried across so the subscription page sees
  // exactly what Paymob sent.
  if (merchantOrderId?.startsWith("sub_")) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string") query.set(key, value);
    }
    const suffix = query.toString();
    redirect(`/payment/subscription/return${suffix ? `?${suffix}` : ""}`);
  }

  // "<bookingId>_<suffix>" since the final audit (F-10): unique per order.
  const bookingId = merchantOrderId ? bookingIdFromMerchantOrderId(merchantOrderId) : null;
  const paymobSuccess = sp.success === "true";

  let booking = null;
  if (bookingId) {
    booking = await db.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:           true,
        status:       true,
        accessToken:  true,
        idempotencyKey: true,
        customerName: true,
        startTime:    true,
        endTime:      true,
        date:         true,
        service:      { select: { nameAr: true, nameEn: true } },
        business:     { select: { nameAr: true, nameEn: true, slug: true } },
        depositAmount: true,
        currency:      true,
        paymobOrderId: true,
        payments:      { select: { providerOrderId: true } },
      },
    });

    // The booking id alone is not proof of anything — it travels in push
    // payloads. The page links to the booking (its access token) only
    // when the redirect also carries the Paymob order this booking was
    // paid through, which only the person who paid has.
    const order = typeof sp.order === "string" ? sp.order : null;
    const proven =
      booking !== null &&
      order !== null &&
      (booking.paymobOrderId === order || booking.payments.some((p) => p.providerOrderId === order));
    if (booking && !proven) booking = { ...booking, accessToken: null };
  }

  // Determine display state from DB status (authoritative)
  const isConfirmed    = booking?.status === "CONFIRMED";
  const isFailed       = booking?.status === "FAILED_PAYMENT";
  const isPending      = booking?.status === "PENDING_PAYMENT";
  // Anything else (cancelled, completed, no-show…) once rendered nothing.
  const isOther        = booking !== null && !isConfirmed && !isFailed && !isPending;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4" dir={en ? "ltr" : "rtl"}>
      <div className="w-full max-w-md">
        {/* Made in the app: hand the person back to it. */}
        {booking?.accessToken && booking.idempotencyKey?.startsWith("app-") && (
          <BackToApp token={booking.accessToken} label="ارجع لتطبيق موعد · Back to the Maw3ed app" />
        )}

        {/* ── Confirmed ── */}
        {isConfirmed && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-ok-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-[var(--color-ok)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "Paid — your booking is confirmed" : "تم الدفع واتأكد الحجز!"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en
                ? "We received your payment and confirmed your booking. You'll get a reminder before the appointment."
                : "وصلتنا دفعتك واتأكد حجزك. هيوصلك تذكير قبل الميعاد."}
            </p>

            <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-md)] p-4 text-start space-y-2.5 mb-6">
              <Row label={en ? "Business" : "المكان"} value={localName(en, booking.business.nameAr, booking.business.nameEn)} />
              <Row label={en ? "Service" : "الخدمة"} value={localName(en, booking.service.nameAr, booking.service.nameEn)} />
              <Row label={en ? "Date" : "التاريخ"} value={booking.date.toISOString().split("T")[0]} ltr />
              <Row label={en ? "Time" : "الوقت"} value={clockRange(booking.startTime, booking.endTime)} ltr />
              {booking.depositAmount !== null && (
                <Row
                  label={en ? "Deposit paid" : "العربون المدفوع"}
                  value={`${Number(booking.depositAmount).toLocaleString(en ? "en-GB" : "ar-EG-u-nu-latn")} ${booking.currency}`}
                  bold
                />
              )}
            </div>

            {booking.accessToken && (
              <Link
                href={`/booking/${booking.accessToken}`}
                className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity mb-3"
              >
                {en ? "View booking details" : "شوف تفاصيل الحجز"}
              </Link>
            )}
            <Link
              href={`/company/${booking.business.slug}`}
              className="block w-full text-center py-2.5 rounded-[var(--radius-md)] border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
            >
              {/* It goes to the business's page, and now says so. */}
              {en ? "Back to the business's page" : "ارجع لصفحة المكان"}
            </Link>
          </div>
        )}

        {/* ── Failed ── */}
        {isFailed && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-danger-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-[var(--color-danger)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "The payment didn't go through" : "الدفع ماتمّش"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en
                ? "The payment wasn't completed, so the booking isn't confirmed. You can try again."
                : "الدفع ماكملش، فالحجز ماتأكدش. تقدر تجرب تاني."}
            </p>
            {booking?.business?.slug && (
              <Link
                href={`/company/${booking.business.slug}`}
                className="flex items-center justify-center gap-2 w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <ArrowRight size={15} />
                {en ? "Try booking again" : "جرّب تحجز تاني"}
              </Link>
            )}
          </div>
        )}

        {/* ── Still pending (webhook not fired yet) ── */}
        {isPending && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-warn-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={44} className="text-[var(--color-star)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "Checking your payment…" : "بنتأكد من الدفع…"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {paymobSuccess
                ? en
                  ? "We received the payment and are checking it. Please wait a moment."
                  : "الدفعة وصلت وبنتأكد منها. استنى لحظة."
                : en
                  ? "We haven't had the payment confirmation yet. If you paid, the booking will be confirmed within minutes."
                  : "لسه ماوصلناش تأكيد الدفع. لو دفعت، الحجز هيتأكد خلال دقايق."}
            </p>
            {booking.accessToken && (
              <Link
                href={`/booking/${booking.accessToken}`}
                className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {en ? "Check the booking's status" : "شوف حالة الحجز"}
              </Link>
            )}
          </div>
        )}

        {/* ── Any other state: say where the booking stands ── */}
        {isOther && booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-surface-3)] rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={44} className="text-[var(--color-faint)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "This booking is no longer awaiting payment" : "الحجز ده مش مستني دفع"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en
                ? "Its status changed (for example, it was cancelled or completed). Open the booking to see where it stands."
                : "حالته اتغيّرت (مثلًا اتلغى أو خلص). افتح الحجز عشان تعرف وصل لفين."}
            </p>
            {booking.accessToken ? (
              <Link
                href={`/booking/${booking.accessToken}`}
                className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {en ? "Open the booking" : "افتح الحجز"}
              </Link>
            ) : (
              <Link
                href={`/company/${booking.business.slug}`}
                className="block w-full text-center py-2.5 rounded-[var(--radius-md)] border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
              >
                {en ? "Go to the business's page" : "روح لصفحة المكان"}
              </Link>
            )}
          </div>
        )}

        {/* ── No booking found ── */}
        {!booking && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-surface-3)] rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-[var(--color-faint)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "Booking not found" : "الحجز مش موجود"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {en
                ? "We couldn't find this booking. Check the booking link or contact support."
                : "ماقدرناش نلاقي الحجز. راجع لينك الحجز أو كلّم الدعم."}
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
        className={`text-end ${bold ? "font-extrabold text-[var(--color-accent)]" : "font-medium text-[var(--color-text-primary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}
