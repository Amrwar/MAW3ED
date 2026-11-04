import { getLang } from "@/lib/lang-server";
import type { Metadata } from "next";
import Link from "@/components/shared/LocaleLink";
import { BadgePercent, CalendarCheck, Package, ShieldCheck, Wallet } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { getAccountUser } from "@/lib/account/queries";
import { walletFor } from "@/lib/account/wallet";
import { dateFull, money, num } from "@/lib/fmt";
import { localName } from "@/lib/lang";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "محفظتي",
  robots: { index: false, follow: false },
};

type WalletData = Awaited<ReturnType<typeof walletFor>>;

/**
 * What this customer holds with the places they book: loyalty points,
 * packages of sessions, memberships.
 *
 * All of it is kept against the verified phone number, never against the
 * account itself — a booking is made under a number, and so is a balance.
 * The layout already turns away an account with no verified number; the
 * branch below is for the case it ever reaches here without one.
 */
export default async function WalletPage() {
  const lang = await getLang();
  const en = lang === "en";
  const say = (ar: string, english: string) => (en ? english : ar);

  const user = await getAccountUser();
  if (!user) {
    return (
      <section className="card p-6">
        <Alert tone="info" title={say("المحفظة مربوطة برقم موبايلك", "Your wallet follows your phone number")}>
          {say(
            "النقاط والباقات والعضويات بتتسجّل على رقم الموبايل اللي بتحجز بيه. أكّد رقمك عشان تشوفها هنا.",
            "Points, packages and memberships are kept against the mobile number you book with. Verify your number to see them here.",
          )}
        </Alert>
        <Link href="/account-login?next=/account/wallet" className="btn btn-primary mt-4 inline-flex">
          {say("أكّد رقم موبايلك", "Verify your number")}
        </Link>
      </section>
    );
  }

  const wallet: WalletData = await walletFor(user.phone);
  const empty = wallet.loyalty.length === 0 && wallet.packages.length === 0 && wallet.memberships.length === 0;

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <h2 className="m-0 flex items-center gap-2.5 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          <Wallet size={18} strokeWidth={1.8} aria-hidden="true" className="text-[var(--color-jade)]" />
          {say("محفظتي", "My wallet")}
        </h2>
        <p className="m-0 mt-2 max-w-[60ch] text-[0.875rem] leading-[1.8] text-[var(--color-muted)]">
          {say(
            "نقاطك وباقاتك وعضوياتك في الأماكن اللي بتحجز فيها، كلها على رقم موبايلك المتأكد. تقدر تستخدمها وإنت بتحجز وإنت داخل بحسابك.",
            "Your points, packages and memberships at the places you book with, all kept against your verified mobile number. You can use them when you book while signed in.",
          )}
        </p>

        {empty && (
          <p className="m-0 mt-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3 text-[0.875rem] leading-[1.8] text-[var(--color-subtle)]">
            {say(
              "محفظتك فاضية لسه. لما مكان بتحجز فيه يديك نقاط، أو تشتري منه باقة جلسات أو عضوية، هتلاقيها هنا.",
              "Your wallet is empty for now. When a place you book with gives you points, or you buy a package of sessions or a membership from one, it shows up here.",
            )}
          </p>
        )}
      </section>

      {/* ── Points ── */}
      {wallet.loyalty.length > 0 && (
        <section className="card p-6" aria-labelledby="wallet-points">
          <SectionHeading id="wallet-points" icon={<BadgePercent size={18} strokeWidth={1.8} aria-hidden="true" />}>
            {say("النقاط", "Points")}
          </SectionHeading>
          <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
            {wallet.loyalty.map((l) => {
              const owner = localName(en, l.ownerName, l.ownerNameEn);
              const program = localName(en, l.programName, l.programNameEn);
              const canRedeem = l.worth.points > 0 && l.worth.cents > 0;
              return (
                <li key={l.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{owner}</p>
                      <p className="m-0 mt-0.5 text-[0.8125rem] text-[var(--color-subtle)]">{program}</p>
                    </div>
                    <p className="m-0 shrink-0 text-end">
                      <span className="num block text-[1.125rem] font-extrabold text-[var(--color-jade)]">
                        {num(l.available, lang)}
                      </span>
                      <span className="block text-[0.6875rem] text-[var(--color-subtle)]">{say("نقطة متاحة", "points available")}</span>
                    </p>
                  </div>

                  {canRedeem && (
                    <p className="m-0 mt-2 text-[0.8125rem] text-[var(--color-muted)]">
                      {say(
                        `كل ${num(l.worth.points, lang)} نقطة = ${money(l.worth.cents / 100, lang)} خصم`,
                        `${num(l.worth.points, lang)} points = ${money(l.worth.cents / 100, lang)} off`,
                      )}
                    </p>
                  )}

                  {l.expiringSoon > 0 && (
                    <p className="m-0 mt-2 rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-1.5 text-[0.8125rem] text-[var(--color-warn)]">
                      {l.nextExpiry
                        ? say(
                            `${num(l.expiringSoon, lang)} نقطة هتنتهي قريب، أولها يوم ${dateFull(l.nextExpiry, lang)}`,
                            `${num(l.expiringSoon, lang)} points expire soon, the first on ${dateFull(l.nextExpiry, lang)}`,
                          )
                        : say(`${num(l.expiringSoon, lang)} نقطة هتنتهي قريب`, `${num(l.expiringSoon, lang)} points expire soon`)}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-[var(--color-subtle)]">
                    <span>
                      {say("إجمالي اللي كسبته", "Earned in total")}: <span className="num">{num(l.lifetimeEarned, lang)}</span>
                    </span>
                    {l.href && (
                      <Link href={l.href} className="font-bold text-[var(--color-jade)]">
                        {say("احجز واستخدمها", "Book and use them")}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Packages ── */}
      {wallet.packages.length > 0 && (
        <section className="card p-6" aria-labelledby="wallet-packages">
          <SectionHeading id="wallet-packages" icon={<Package size={18} strokeWidth={1.8} aria-hidden="true" />}>
            {say("باقات الجلسات", "Session packages")}
          </SectionHeading>
          <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
            {wallet.packages.map((p) => (
              <li key={p.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{localName(en, p.name, p.nameEn)}</p>
                    <p className="m-0 mt-0.5 text-[0.8125rem] text-[var(--color-subtle)]">
                      {localName(en, p.businessName, p.businessNameEn)}
                    </p>
                  </div>
                  <StatusPill tone={p.status === "ACTIVE" ? "ok" : "muted"}>
                    {p.status === "ACTIVE"
                      ? say("شغّالة", "Active")
                      : p.status === "EXHAUSTED"
                        ? say("خلصت", "Used up")
                        : say("انتهت", "Expired")}
                  </StatusPill>
                </div>
                <p className="m-0 mt-2 text-[0.875rem] text-[var(--color-ink)]">
                  {say(
                    `فاضل ${num(p.left, lang)} من ${num(p.total, lang)} جلسة`,
                    `${num(p.left, lang)} of ${num(p.total, lang)} sessions left`,
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-[var(--color-subtle)]">
                  <span>
                    {p.expiresAt
                      ? p.status === "EXPIRED"
                        ? say(`انتهت يوم ${dateFull(p.expiresAt, lang)}`, `Expired on ${dateFull(p.expiresAt, lang)}`)
                        : say(`صالحة لحد ${dateFull(p.expiresAt, lang)}`, `Valid until ${dateFull(p.expiresAt, lang)}`)
                      : say("من غير تاريخ انتهاء", "No expiry date")}
                  </span>
                  {p.status === "ACTIVE" && p.left > 0 && (
                    <Link href={p.href} className="font-bold text-[var(--color-jade)]">
                      {say("احجز جلسة", "Book a session")}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Memberships ── */}
      {wallet.memberships.length > 0 && (
        <section className="card p-6" aria-labelledby="wallet-memberships">
          <SectionHeading id="wallet-memberships" icon={<CalendarCheck size={18} strokeWidth={1.8} aria-hidden="true" />}>
            {say("العضويات", "Memberships")}
          </SectionHeading>
          <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
            {wallet.memberships.map((m) => (
              <li key={m.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{localName(en, m.name, m.nameEn)}</p>
                    <p className="m-0 mt-0.5 text-[0.8125rem] text-[var(--color-subtle)]">
                      {localName(en, m.businessName, m.businessNameEn)}
                    </p>
                  </div>
                  <StatusPill tone={m.status === "ACTIVE" ? "ok" : m.status === "PAUSED" ? "warn" : "muted"}>
                    {m.status === "ACTIVE"
                      ? say("شغّالة", "Active")
                      : m.status === "PAUSED"
                        ? say("متوقفة مؤقتًا", "Paused")
                        : say("انتهت", "Expired")}
                  </StatusPill>
                </div>
                {m.status === "ACTIVE" && m.included > 0 && (
                  <p className="m-0 mt-2 text-[0.875rem] text-[var(--color-ink)]">
                    {say(
                      `استخدمت ${num(m.used, lang)} من ${num(m.included, lang)} زيارة في الفترة دي`,
                      `${num(m.used, lang)} of ${num(m.included, lang)} visits used this period`,
                    )}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-[var(--color-subtle)]">
                  <span>
                    {m.paidThrough
                      ? m.cancelAtPeriodEnd
                        ? say(`مدفوعة لحد ${dateFull(m.paidThrough, lang)}، ومش هتتجدد`, `Paid through ${dateFull(m.paidThrough, lang)}, and won't renew`)
                        : say(`مدفوعة لحد ${dateFull(m.paidThrough, lang)}`, `Paid through ${dateFull(m.paidThrough, lang)}`)
                      : ""}
                  </span>
                  {m.status === "ACTIVE" && (
                    <Link href={m.href} className="font-bold text-[var(--color-jade)]">
                      {say("احجز زيارة", "Book a visit")}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="m-0 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
        <ShieldCheck size={15} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0" />
        {say(
          "كل مكان هو اللي بيحدد نقاطه وباقاته. لو في رصيد مش مظبوط، كلّم المكان نفسه.",
          "Each place sets its own points and packages. If a balance looks wrong, contact the place itself.",
        )}
      </p>
    </div>
  );
}

function SectionHeading({ id, icon, children }: { id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="m-0 flex items-center gap-2.5 text-[1rem] font-bold text-[var(--color-ink)]">
      <span className="text-[var(--color-jade)]">{icon}</span>
      {children}
    </h2>
  );
}

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold",
        tone === "ok" && "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
        tone === "warn" && "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
        tone === "muted" && "bg-[var(--color-surface-2)] text-[var(--color-subtle)]",
      )}
    >
      {children}
    </span>
  );
}
