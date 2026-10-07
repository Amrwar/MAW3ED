import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { getAccountUser, getPaymentHistory } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { formatCents } from "@/lib/payments/money";
import type { PaymentKind } from "@prisma/client";

export const metadata: Metadata = {
  title: "المدفوعات",
  robots: { index: false, follow: false },
};

const KIND_AR: Record<PaymentKind, string> = {
  BOOKING_DEPOSIT: "عربون",
  BOOKING_BALANCE: "باقي الحساب",
  BOOKING_FULL: "دفع كامل",
  SUBSCRIPTION: "اشتراك",
};

/**
 * What this customer has paid, and the receipt number for each.
 *
 * This page used to say only that Maw3ed stores no cards — which is
 * still true and still said below, because a page inventing "saved
 * cards" would be a lie. What it could not do was answer the question
 * people actually arrive with, which is "what did I pay, and what do I
 * quote to ask about it": payment state lived in two columns on the
 * booking and there was no receipt number to quote.
 *
 * Declined attempts are not listed. Nobody needs to be reminded of a
 * card that failed three weeks ago to find the deposit they paid.
 */
export default async function PaymentsPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;
  const isAr = lang === "ar";

  const payments = user.phone ? await getPaymentHistory(user.phone) : [];

  return (
    <div className="space-y-5">
      {/* ── History ── */}
      <section className="card p-6">
        <h2 className="m-0 flex items-center gap-2.5 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          <Receipt size={18} strokeWidth={1.8} aria-hidden="true" className="text-[var(--color-jade)]" />
          {isAr ? "سجل المدفوعات" : "Payment history"}
        </h2>

        {payments.length === 0 ? (
          <p className="m-0 mt-4 text-[0.9375rem] leading-[1.8] text-[var(--color-muted)]">
            {isAr
              ? "لسه مدفعتش حاجة من خلال موعد. أول ما تدفع عربون أو حساب، هيظهر هنا برقم إيصال تقدر ترجعله."
              : "You haven't paid anything through Maw3ed yet. Once you do, it appears here with a receipt number you can quote."}
          </p>
        ) : (
          <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
            {payments.map((p) => {
              const net = p.amountCents - p.refundedCents;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
                      {(isAr ? p.businessAr : p.businessEn) ?? p.businessAr}
                    </p>
                    <p className="m-0 mt-0.5 text-[0.8125rem] text-[var(--color-subtle)]">
                      {KIND_AR[p.kind]}
                      {p.serviceAr ? ` · ${isAr ? p.serviceAr : (p.serviceEn ?? p.serviceAr)}` : ""}
                    </p>
                    <p className="num m-0 mt-1 text-[0.6875rem] text-[var(--color-faint)]">
                      {p.receiptNumber && <span dir="ltr">{p.receiptNumber}</span>}
                      {p.paidAt && (
                        <> · {new Date(p.paidAt).toLocaleDateString("ar-EG-u-nu-latn")}</>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <span className="num block text-[0.9375rem] font-bold text-[var(--color-ink)]">
                      {formatCents(net, p.currency, lang)}
                    </span>
                    {p.refundedCents > 0 && (
                      <span className="num block text-[0.6875rem] text-[var(--color-danger)]">
                        {isAr ? "اتسترجع" : "Refunded"} {formatCents(p.refundedCents, p.currency, lang)}
                      </span>
                    )}
                    {p.businessSlug && (
                      <Link
                        href={`/company/${p.businessSlug}`}
                        className="mt-1 inline-block text-[0.6875rem] font-bold text-[var(--color-jade)]"
                      >
                        {isAr ? "الصفحة" : "View"}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Still true, still worth saying ── */}
      <section className="card p-6">
        <span
          aria-hidden="true"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
        >
          <ShieldCheck size={22} strokeWidth={1.8} />
        </span>

        <h2 className="m-0 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          {t.account.payments.title}
        </h2>
        <p className="m-0 mt-2.5 max-w-[56ch] text-[0.9375rem] leading-[1.8] text-[var(--color-muted)]">
          {t.account.payments.body}
        </p>

        <p className="m-0 mt-5 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3 text-[0.84375rem] leading-relaxed text-[var(--color-subtle)]">
          <CreditCard size={15} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t.account.payments.deposits}
        </p>
      </section>
    </div>
  );
}
