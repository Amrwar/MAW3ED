"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { localeFor } from "@/lib/fmt";
import type { Lang } from "@/lib/i18n";

/* One visitor pass, as its holder sees it (booking page and guest link). */

export interface PassViewJson {
  guestId: string;
  role: "HOLDER" | "GUEST";
  displayName: string;
  state: "ineligible" | "pending" | "active" | "updating" | "suspended" | "revoked" | "expired" | "failed" | "withdrawing";
  reason: string | null;
  validFrom: string | null;
  validUntil: string | null;
  entryUntil: string | null;
  gates: string[];
  reentryAllowed: boolean;
  pass: { token: string; format: string; sandbox: boolean } | null;
  canRetry: boolean;
  inviteToken?: string;
  qrSvg?: string | null;
}

const STATE: Record<PassViewJson["state"], { label: [ar: string, en: string]; tone: string }> = {
  ineligible: { label: ["مش مؤهل", "Not eligible"], tone: "text-[var(--color-subtle)] bg-[var(--color-surface-2)]" },
  pending: { label: ["مستني موافقة نظام الدخول", "Waiting for the access system"], tone: "text-[var(--color-star)] bg-[var(--color-warn-soft)]" },
  active: { label: ["فعّال", "Active"], tone: "text-[var(--color-ok)] bg-[var(--color-ok-soft)]" },
  updating: { label: ["فعّال — بيتحدّث بالميعاد الجديد", "Active — updating to the new time"], tone: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
  suspended: { label: ["موقوف مؤقتًا", "Temporarily suspended"], tone: "text-[var(--color-star)] bg-[var(--color-warn-soft)]" },
  revoked: { label: ["اتلغى", "Cancelled"], tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
  withdrawing: { label: ["بيتلغي", "Being cancelled"], tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
  expired: { label: ["انتهى", "Expired"], tone: "text-[var(--color-subtle)] bg-[var(--color-surface-2)]" },
  failed: { label: ["ماتصدرش", "Not issued"], tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
};

const time = (iso: string | null, lang: Lang) =>
  iso
    ? new Intl.DateTimeFormat(localeFor(lang), { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : null;

export default function PassCard({ v, onRetry, busy }: { v: PassViewJson; onRetry?: () => void; busy?: boolean }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const s = STATE[v.state];
  const showCode = (v.state === "active" || v.state === "updating") && v.pass;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm">{v.displayName}{v.role === "HOLDER" ? t(" (إنت)", " (you)") : ""}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.tone}`} role="status">{en ? s.label[1] : s.label[0]}</span>
      </div>

      {v.reason && v.state !== "active" && <p className="text-xs text-[var(--color-muted)]">{v.reason}</p>}

      {showCode && v.qrSvg && (
        <div className="space-y-2">
          {v.pass!.sandbox && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
              {t("تصريح تجريبي — مش صالح عند أي بوابة حقيقية", "Test pass — not valid at any real gate")}
            </p>
          )}
          <div
            className="mx-auto w-56 max-w-full bg-white p-2 rounded-[var(--radius-sm)]"
            role="img"
            aria-label={t(`كود تصريح الدخول لـ ${v.displayName}. اعرضه على بوابة المكان.`, `Visitor pass code for ${v.displayName}. Show it at the venue's gate.`)}
            // Generated on our server by the qrcode library from the pass
            // token; contains no markup from anyone else.
            dangerouslySetInnerHTML={{ __html: v.qrSvg }}
          />
          <p className="text-center text-[0.7rem] text-[var(--color-muted)]">{t("لو البوابة مش قادرة تقرا الكود، اطلب من الأمن يدوّر على اسمك.", "If the gate can't read the code, ask security to look up your name.")}</p>
        </div>
      )}

      {(v.validFrom || v.validUntil) && v.state !== "expired" && v.state !== "revoked" && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-[var(--color-muted)]">{t("من", "From")}</dt><dd dir="ltr" className="text-end">{time(v.validFrom, lang)}</dd>
          <dt className="text-[var(--color-muted)]">{t("لحد", "Until")}</dt><dd dir="ltr" className="text-end">{time(v.validUntil, lang)}</dd>
          {v.entryUntil && (<><dt className="text-[var(--color-muted)]">{t("آخر دخول", "Last entry")}</dt><dd dir="ltr" className="text-end">{time(v.entryUntil, lang)}</dd></>)}
          <dt className="text-[var(--color-muted)]">{t("البوابات", "Gates")}</dt><dd className="text-end">{v.gates.length ? v.gates.join(t("، ", ", ")) : t("أي بوابة", "Any gate")}</dd>
          <dt className="text-[var(--color-muted)]">{t("خروج ورجوع", "Leave and return")}</dt><dd className="text-end">{v.reentryAllowed ? t("مسموح", "Allowed") : t("مرة واحدة", "Once only")}</dd>
        </dl>
      )}

      {v.state === "failed" && v.canRetry && onRetry && (
        <button type="button" className="btn btn-outline btn-sm w-full" onClick={onRetry} disabled={busy}>
          {t("اطلب التصريح تاني", "Request the pass again")}
        </button>
      )}
      {v.state === "failed" && !v.canRetry && (
        <p className="text-xs text-[var(--color-muted)]">{t("اتحاول كذا مرة. كلّم أمن المكان أو المكان اللي حجزت فيه.", "Tried several times. Contact the venue's security or the place you booked with.")}</p>
      )}
    </div>
  );
}
