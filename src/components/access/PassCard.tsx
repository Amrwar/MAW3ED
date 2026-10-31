"use client";

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

const STATE: Record<PassViewJson["state"], { label: string; tone: string }> = {
  ineligible: { label: "مش مؤهل", tone: "text-[var(--color-subtle)] bg-[var(--color-surface-2)]" },
  pending: { label: "مستني موافقة نظام الدخول", tone: "text-[var(--color-star)] bg-[var(--color-warn-soft)]" },
  active: { label: "فعّال", tone: "text-[var(--color-ok)] bg-[var(--color-ok-soft)]" },
  updating: { label: "فعّال — بيتحدّث بالميعاد الجديد", tone: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
  suspended: { label: "موقوف مؤقتًا", tone: "text-[var(--color-star)] bg-[var(--color-warn-soft)]" },
  revoked: { label: "اتلغى", tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
  withdrawing: { label: "بيتلغي", tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
  expired: { label: "انتهى", tone: "text-[var(--color-subtle)] bg-[var(--color-surface-2)]" },
  failed: { label: "ماتصدرش", tone: "text-[var(--color-danger)] bg-[var(--color-danger-soft)]" },
};

const time = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : null;

export default function PassCard({ v, onRetry, busy }: { v: PassViewJson; onRetry?: () => void; busy?: boolean }) {
  const s = STATE[v.state];
  const showCode = (v.state === "active" || v.state === "updating") && v.pass;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm">{v.displayName}{v.role === "HOLDER" ? " (إنت)" : ""}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.tone}`} role="status">{s.label}</span>
      </div>

      {v.reason && v.state !== "active" && <p className="text-xs text-[var(--color-muted)]">{v.reason}</p>}

      {showCode && v.qrSvg && (
        <div className="space-y-2">
          {v.pass!.sandbox && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
              تصريح تجريبي — مش صالح عند أي بوابة حقيقية
            </p>
          )}
          <div
            className="mx-auto w-56 max-w-full bg-white p-2 rounded-[var(--radius-sm)]"
            role="img"
            aria-label={`كود تصريح الدخول لـ ${v.displayName}. اعرضه على بوابة المكان.`}
            // Generated on our server by the qrcode library from the pass
            // token; contains no markup from anyone else.
            dangerouslySetInnerHTML={{ __html: v.qrSvg }}
          />
          <p className="text-center text-[0.7rem] text-[var(--color-muted)]">لو البوابة مش قادرة تقرا الكود، اطلب من الأمن يدوّر على اسمك.</p>
        </div>
      )}

      {(v.validFrom || v.validUntil) && v.state !== "expired" && v.state !== "revoked" && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-[var(--color-muted)]">من</dt><dd dir="ltr" className="text-end">{time(v.validFrom)}</dd>
          <dt className="text-[var(--color-muted)]">لحد</dt><dd dir="ltr" className="text-end">{time(v.validUntil)}</dd>
          {v.entryUntil && (<><dt className="text-[var(--color-muted)]">آخر دخول</dt><dd dir="ltr" className="text-end">{time(v.entryUntil)}</dd></>)}
          <dt className="text-[var(--color-muted)]">البوابات</dt><dd className="text-end">{v.gates.length ? v.gates.join("، ") : "أي بوابة"}</dd>
          <dt className="text-[var(--color-muted)]">خروج ورجوع</dt><dd className="text-end">{v.reentryAllowed ? "مسموح" : "مرة واحدة"}</dd>
        </dl>
      )}

      {v.state === "failed" && v.canRetry && onRetry && (
        <button type="button" className="btn btn-outline btn-sm w-full" onClick={onRetry} disabled={busy}>
          اطلب التصريح تاني
        </button>
      )}
      {v.state === "failed" && !v.canRetry && (
        <p className="text-xs text-[var(--color-muted)]">اتحاول كذا مرة. كلّم أمن المكان أو المكان اللي حجزت فيه.</p>
      )}
    </div>
  );
}
