import type { Metadata } from "next";
import { CreditCard, ShieldCheck } from "lucide-react";
import { getAccountUser } from "@/lib/account/queries";
import { translations, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "طرق الدفع", robots: { index: false, follow: false } };

/**
 * There is nothing to manage here, and saying so plainly is the honest
 * page. Maw3ed never sees a card: a deposit is paid on the provider's
 * own hosted page, and nothing is stored to be listed, edited or
 * deleted. A page that invented "saved cards" would be a lie.
 */
export default async function PaymentsPage() {
  const user = await getAccountUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  return (
    <div className="card p-6">
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
    </div>
  );
}
