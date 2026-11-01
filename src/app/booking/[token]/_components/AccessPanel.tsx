"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import PassCard, { type PassViewJson } from "@/components/access/PassCard";

/**
 * The booking page's "getting in" section: the booking's own check-in QR
 * (for the business's front desk) and, where the venue offers them,
 * visitor passes (for the venue's gates) — two different codes, labelled
 * so nobody shows one where the other is wanted. Reads and acts through
 * /api/booking/:token/access, the same API the app uses.
 *
 * A pending pass is re-checked a bounded number of times (POLL_MAX), then
 * left to a "check again" button: never an endless poll.
 */

interface Payload {
  checkIn: {
    display: "ready" | "not-yet" | "checked-in" | "unavailable";
    url: string | null;
    qrSvg: string | null;
    opensAt: string | null;
    closesAt: string | null;
    checkedInAt: string | null;
  };
  visitorAccess: {
    offered: boolean;
    venue: { id: string; name: string; instructions: string | null } | null;
    sandbox: boolean;
    eligibility: { eligible: boolean; reason: string | null };
    guestLimit: number;
    identityRequirement: "NAME" | "NAME_AND_PHONE";
    holder: PassViewJson | null;
    guests: PassViewJson[];
  };
}

const POLL_MS = 4000;
const POLL_MAX = 10;
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default function AccessPanel({ token, customerName }: { token: string; customerName: string }) {
  const base = `/api/booking/${token}/access`;
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  const fetchPayload = useCallback(async (): Promise<Payload | null> => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      return res.ok ? ((await res.json()) as Payload) : null;
    } catch {
      return null;
    }
  }, [base]);
  const apply = useCallback((p: Payload | null) => {
    if (p) setData(p);
    setFailed(!p);
  }, []);
  const load = useCallback(async () => apply(await fetchPayload()), [apply, fetchPayload]);

  useEffect(() => {
    let live = true;
    void fetchPayload().then((p) => {
      if (live) apply(p);
    });
    return () => {
      live = false;
    };
  }, [fetchPayload, apply]);

  const pending = !!data && [data.visitorAccess.holder, ...data.visitorAccess.guests].some((p) => p && (p.state === "pending" || p.state === "withdrawing"));
  useEffect(() => {
    if (!pending || polls >= POLL_MAX) return;
    const t = setTimeout(() => {
      setPolls((n) => n + 1);
      void load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [pending, data, polls, load]);

  async function act(path: string, method: string, body?: unknown, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? done ?? null : j.error ?? "حصلت مشكلة، جرّب تاني");
      setPolls(0);
      await load();
      return res.ok ? j : null;
    } catch {
      setMsg("تعذّر الاتصال، جرّب تاني");
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (failed && !data) {
    return (
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 text-sm">
        مقدرناش نحمّل كود الوصول. <button className="underline" onClick={() => void load()}>جرّب تاني</button>
      </div>
    );
  }
  if (!data) return null;
  const { checkIn: c, visitorAccess: va } = data;

  return (
    <>
      {c.display !== "unavailable" && (
        <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3" aria-labelledby="checkin-h">
          <div className="flex items-center gap-2">
            <QrCode size={18} aria-hidden="true" />
            <h2 id="checkin-h" className="font-bold text-sm">كود تسجيل الوصول</h2>
          </div>
          {c.display === "checked-in" ? (
            <p className="text-sm text-[var(--color-ok)]">
              اتسجّل وصولك{c.checkedInAt ? ` الساعة ${new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(c.checkedInAt))}` : ""}.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--color-muted)]">
                اعرضه على الاستقبال لما توصل عشان يسجّلوا وصولك. ده كود الحجز بس — مش تصريح دخول للمول أو الكمبوند.
              </p>
              {c.qrSvg && (
                <div
                  className="mx-auto w-60 max-w-full bg-white p-2 rounded-[var(--radius-sm)] border border-[var(--color-line)]"
                  role="img"
                  aria-label="كود QR لتسجيل وصولك للحجز. اعرضه على الاستقبال."
                  // Generated on our server by the qrcode library from our own URL.
                  dangerouslySetInnerHTML={{ __html: c.qrSvg }}
                />
              )}
              <p className="text-xs text-center" dir="rtl">
                {c.display === "not-yet" ? "الكود بيشتغل " : "شغّال "}
                <span dir="ltr">{c.opensAt} – {c.closesAt}</span>
              </p>
              <p className="text-[0.7rem] text-[var(--color-muted)]">
                لو الكود مش بيتقري، قول اسمك ({customerName}) ورقم الحجز للاستقبال.
              </p>
              <button
                type="button"
                className="text-xs underline text-[var(--color-muted)]"
                disabled={busy}
                onClick={() => void act("/check-in", "POST", undefined, "اتعمل كود جديد، والقديم بطل يشتغل.")}
              >
                <RefreshCw size={12} className="inline me-1" aria-hidden="true" />
                حد تاني شاف الكود؟ اعمل كود جديد
              </button>
            </>
          )}
        </section>
      )}

      {va.offered && va.venue && (
        <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3" aria-labelledby="pass-h">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} aria-hidden="true" />
            <h2 id="pass-h" className="font-bold text-sm">تصريح دخول {va.venue.name}</h2>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            تصريح منفصل عن كود الحجز. بيصدر من نظام دخول {va.venue.name}، ومش بيبقى صالح غير لما النظام ده يوافق عليه.
          </p>
          {va.sandbox && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-star)]">
              بيئة تجريبية: التصاريح هنا مش صالحة عند أي بوابة حقيقية.
            </p>
          )}
          {va.venue.instructions && <p className="text-xs whitespace-pre-line">{va.venue.instructions}</p>}

          {va.holder ? (
            <PassCard v={va.holder} busy={busy} onRetry={() => void act(`/guests/${va.holder!.guestId}/retry`, "POST")} />
          ) : va.eligibility.eligible ? (
            <VisitorForm
              initialName={customerName}
              // The booking's own number is used when the venue needs one
              // and none is typed here.
              phone={va.identityRequirement === "NAME_AND_PHONE" ? "optional" : "none"}
              busy={busy}
              cta="اطلب تصريح دخول"
              onSubmit={(v) => act("/pass", "POST", v, "اتطلب التصريح.")}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">{va.eligibility.reason ?? "التصريح مش متاح للحجز ده دلوقتي."}</p>
          )}

          {va.holder && va.guestLimit > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
              <p className="text-xs font-bold">المرافقين ({va.guests.length} من {va.guestLimit})</p>
              {va.guests.map((g) => (
                <div key={g.guestId} className="space-y-1">
                  <PassCard v={g} busy={busy} onRetry={() => void act(`/guests/${g.guestId}/retry`, "POST")} />
                  <div className="flex gap-2">
                    {g.inviteToken && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm flex-1"
                        onClick={() => {
                          const url = `${window.location.origin}/pass/${g.inviteToken}`;
                          void navigator.clipboard?.writeText(url).then(() => setMsg(`اتنسخ رابط ${g.displayName}. ابعته له.`), () => setMsg(url));
                        }}
                      >
                        انسخ رابط التصريح
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label={`شيل ${g.displayName}`}
                      disabled={busy}
                      onClick={() => void act(`/guests/${g.guestId}`, "DELETE", undefined, "اتشال، وتصريحه اتلغى.")}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {va.guests.length < va.guestLimit && (
                <VisitorForm
                  initialName=""
                  phone={va.identityRequirement === "NAME_AND_PHONE" ? "required" : "none"}
                  busy={busy}
                  cta="ضيف مرافق"
                  icon
                  onSubmit={(v) => act("/guests", "POST", v, "اتضاف. انسخ رابطه وابعته له.")}
                />
              )}
            </div>
          )}
          {pending && polls >= POLL_MAX && (
            <button type="button" className="btn btn-outline btn-sm w-full" onClick={() => { setPolls(0); void load(); }}>
              شوف الحالة تاني
            </button>
          )}
        </section>
      )}
      {msg && <p className="text-sm text-center" role="status">{msg}</p>}
    </>
  );
}

function VisitorForm({
  initialName, phone: phoneMode, busy, cta, icon, onSubmit,
}: {
  initialName: string;
  phone: "none" | "optional" | "required";
  busy: boolean;
  cta: string;
  icon?: boolean;
  onSubmit: (v: { displayName: string; phone: string | null }) => Promise<unknown>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await onSubmit({ displayName: name, phone: phone || null });
        if (r && !initialName) {
          setName("");
          setPhone("");
        }
      }}
    >
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم زي ما في البطاقة" aria-label="الاسم" required minLength={2} maxLength={80} />
      {phoneMode !== "none" && (
        <input
          className={field}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={phoneMode === "optional" ? "رقم الموبايل (لو مختلف عن رقم الحجز)" : "رقم الموبايل"}
          aria-label="رقم الموبايل"
          dir="ltr"
          inputMode="tel"
          required={phoneMode === "required"}
        />
      )}
      <button type="submit" className="btn btn-primary btn-sm w-full" disabled={busy}>
        {icon && <UserPlus size={14} aria-hidden="true" />} {cta}
      </button>
    </form>
  );
}
