import type { Metadata } from "next";
import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight, Receipt, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/payments/money";
import { PLAN_NAMES_AR, PLAN_NAMES_EN } from "@/lib/plans";
import { getLang } from "@/lib/lang-server";
import { cairoDay, type Lang } from "@/lib/i18n";
import type { PaymentKind, PaymentStatus } from "@prisma/client";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "en" ? "Billing and payments" : "الفواتير والمدفوعات" };
}

/** From the business's side: who paid whom (final audit F-33: was Arabic-only). */
const KIND: Record<PaymentKind, Record<Lang, string>> = {
  BOOKING_DEPOSIT: { ar: "عربون من عميل", en: "Customer deposit" },
  BOOKING_BALANCE: { ar: "باقي حساب", en: "Balance" },
  BOOKING_FULL: { ar: "دفع كامل من عميل", en: "Customer full payment" },
  SUBSCRIPTION: { ar: "اشتراك موعد", en: "Maw3ed subscription" },
  PACKAGE: { ar: "باقة جلسات", en: "Session package" },
  MEMBERSHIP: { ar: "عضوية", en: "Membership" },
};

const STATUS: Record<PaymentStatus, Record<Lang, string>> = {
  PENDING: { ar: "قيد الدفع", en: "Pending" },
  SUCCEEDED: { ar: "تم", en: "Paid" },
  FAILED: { ar: "فشلت", en: "Failed" },
  REFUNDED: { ar: "مُسترجَعة", en: "Refunded" },
  PARTIALLY_REFUNDED: { ar: "استرجاع جزئي", en: "Partly refunded" },
  ABANDONED: { ar: "متروكة", en: "Abandoned" },
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  PENDING: "text-[var(--color-warn)]",
  SUCCEEDED: "text-[var(--color-ok)]",
  FAILED: "text-[var(--color-danger)]",
  REFUNDED: "text-[var(--color-subtle)]",
  PARTIALLY_REFUNDED: "text-[var(--color-warn)]",
  ABANDONED: "text-[var(--color-subtle)]",
};

/**
 * The money, from the business's side.
 *
 * This page used to redirect to the subscription tab in settings,
 * because there was nothing here that tab did not already show. There
 * is now: what customers have paid this business, what the business has
 * paid Maw3ed, and every attempt that failed — none of which fits in a
 * subscription panel, and none of which existed before the ledger.
 *
 * The subscription panel is still where a plan is bought; this links to
 * it rather than growing a second copy that would drift from it.
 */
export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");
  const businessId = session.user.businessId;
  const lang = await getLang();
  const en = lang === "en";
  const planNames = en ? PLAN_NAMES_EN : PLAN_NAMES_AR;
  const Forward = en ? ArrowRight : ArrowLeft;

  const [business, payments, received, paidOut] = await Promise.all([
    db.business.findUnique({ where: { id: businessId }, select: { plan: true } }),
    db.payment.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        status: true,
        provider: true,
        amountCents: true,
        refundedCents: true,
        currency: true,
        plan: true,
        receiptNumber: true,
        paidAt: true,
        failureReason: true,
        createdAt: true,
        booking: { select: { reference: true, customerName: true } },
      },
    }),
    // What customers paid in, net of anything sent back.
    db.payment.aggregate({
      where: {
        businessId,
        kind: { not: "SUBSCRIPTION" },
        status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      _sum: { amountCents: true, refundedCents: true },
    }),
    // What the business paid Maw3ed.
    db.payment.aggregate({
      where: {
        businessId,
        kind: "SUBSCRIPTION",
        status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      _sum: { amountCents: true, refundedCents: true },
    }),
  ]);

  if (!business) redirect("/dashboard");

  const net = (agg: { _sum: { amountCents: number | null; refundedCents: number | null } }) =>
    (agg._sum.amountCents ?? 0) - (agg._sum.refundedCents ?? 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.375rem] font-bold text-[var(--color-ink)]">
          {en ? "Billing and payments" : "الفواتير والمدفوعات"}
        </h1>
        <p className="m-0 mt-1.5 text-[0.875rem] text-[var(--color-subtle)]">
          {en
            ? "Every payment on this business — what customers paid, and what you paid."
            : "كل عملية دفع على النشاط ده — اللي العملاء دفعوه واللي انت دفعته."}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={<Wallet size={16} strokeWidth={1.8} aria-hidden="true" />}
          label={en ? "Collected from customers" : "محصّل من العملاء"}
          value={formatCents(net(received), "EGP", lang)}
        />
        <Tile
          icon={<Receipt size={16} strokeWidth={1.8} aria-hidden="true" />}
          label={en ? "Paid to Maw3ed" : "مدفوع لموعد"}
          value={formatCents(net(paidOut), "EGP", lang)}
          hint={en ? `Current plan: ${planNames[business.plan]}` : `الخطة الحالية: ${planNames[business.plan]}`}
        />
        <Link
          href="/dashboard/settings?tab=subscription"
          className="card card-hover flex min-h-[5rem] flex-col justify-center p-4"
        >
          <span className="text-[0.75rem] text-[var(--color-subtle)]">{en ? "Subscription" : "الاشتراك"}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[0.9375rem] font-bold text-[var(--color-jade)]">
            {en ? "Manage the plan" : "إدارة الخطة"}
            <Forward size={14} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </Link>
      </div>

      <section className="card overflow-hidden">
        {payments.length === 0 ? (
          <p className="m-0 p-10 text-center text-[0.875rem] text-[var(--color-subtle)]">
            {en ? "No payments on this business yet." : "لسه مفيش عمليات دفع على النشاط ده."}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] p-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
                    {KIND[p.kind][lang]}
                    {p.plan ? ` · ${planNames[p.plan]}` : ""}
                  </p>
                  <p className="m-0 mt-0.5 text-[0.78125rem] text-[var(--color-subtle)]">
                    {p.booking?.customerName ?? "—"}
                    {p.provider === "MANUAL" && (en ? " · recorded by hand" : " · اتسجّلت يدويًا")}
                  </p>
                  {p.failureReason && (
                    <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-danger)]">
                      {p.failureReason}
                    </p>
                  )}
                  <p className="num m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">
                    {p.receiptNumber && <span dir="ltr">{p.receiptNumber}</span>}
                    {p.booking?.reference && <> · {p.booking.reference}</>}
                    {" · "}
                    {cairoDay(p.paidAt ?? p.createdAt, lang)}
                  </p>
                </div>

                <div className="shrink-0 text-end">
                  <span className="num block text-[0.9375rem] font-bold text-[var(--color-ink)]">
                    {formatCents(p.amountCents - p.refundedCents, p.currency, lang)}
                  </span>
                  <span className={`block text-[0.6875rem] font-bold ${STATUS_TONE[p.status]}`}>
                    {STATUS[p.status][lang]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card flex min-h-[5rem] flex-col justify-center p-4">
      <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-subtle)]">
        {icon}
        {label}
      </span>
      <span className="num mt-1 block text-[1.0625rem] font-bold text-[var(--color-ink)]">
        {value}
      </span>
      {hint && <span className="mt-0.5 block text-[0.6875rem] text-[var(--color-subtle)]">{hint}</span>}
    </div>
  );
}
