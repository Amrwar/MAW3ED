"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, QrCode, RefreshCw, ShieldCheck, Trash2, UserPlus, WifiOff } from "lucide-react";
import PassCard, { type PassViewJson } from "@/components/access/PassCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { localeFor } from "@/lib/fmt";
import { refusalText } from "@/lib/lang";
import { buildQrPng, deliverQrImage, saveQrImage } from "@/lib/access/save-qr";
import { refreshKeptBookingPage } from "@/lib/access/offline-refresh";

/**
 * The booking page's "getting in" section: the booking's own check-in QR
 * (for the business's front desk) and, where the venue offers them,
 * visitor passes (for the venue's gates) — two different codes, labelled
 * so nobody shows one where the other is wanted. Reads and acts through
 * /api/booking/:token/access, the same API the app uses.
 *
 * A pending pass is re-checked a bounded number of times (POLL_MAX), then
 * left to a "check again" button: never an endless poll.
 *
 * The page renders the first payload on the server (`initial`), so the QR
 * is in the page itself and a copy of the page the phone kept (public/
 * sw.js) shows it with no connection. Then: one refresh when the panel
 * mounts, only if the page may be such a copy (or came without a
 * payload), and one each time the browser says it is back online — never
 * a loop. Without a connection the last payload stays on screen with a
 * note saying how old it is; the code itself is checked online when
 * scanned. When what the panel shows changes without a page load (a new
 * code, a pass), the kept copy is fetched again so it matches.
 */

/** Rendered this recently, the page is not a kept copy: no refresh on mount. */
const FRESH_MS = 15_000;

/** What, if it changes, makes the phone's kept copy out of date. */
function shown(p: Payload | null): string {
  if (!p) return "";
  const passes = [p.visitorAccess.holder, ...p.visitorAccess.guests].map((x) => (x ? `${x.state}:${x.pass?.token ?? ""}` : ""));
  return [p.checkIn.display, p.checkIn.url ?? "", ...passes].join("|");
}

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

export default function AccessPanel({
  token,
  customerName,
  initial = null,
  savedAt = null,
  reference = null,
  caption = [],
}: {
  token: string;
  customerName: string;
  /** The payload the server rendered the page with. */
  initial?: Payload | null;
  /** When that payload was made (ISO), shown when offline. */
  savedAt?: string | null;
  /** The booking number, for the saved QR's file name and caption. */
  reference?: string | null;
  /** Lines under the saved QR besides the number and times: the business, the day. */
  caption?: string[];
}) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  const base = `/api/booking/${token}/access`;
  // The server words reasons, gates and errors in this language.
  const q = en ? "?lang=en" : "";
  const [data, setData] = useState<Payload | null>(initial);
  const [failed, setFailed] = useState(false);
  // No connection on the last attempt (not a refusal from the server).
  const [offline, setOffline] = useState(false);
  const [asOf, setAsOf] = useState<string | null>(savedAt);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [confirmNewCode, setConfirmNewCode] = useState(false);
  // The check-in QR as a picture, made ahead of the "save" tap.
  const [qrPicture, setQrPicture] = useState<{ key: string; blob: Blob } | null>(null);
  const qrSvg = data?.checkIn.qrSvg ?? null;
  const qrCaption = [
    ...caption,
    data?.checkIn.opensAt && data?.checkIn.closesAt ? `${data.checkIn.opensAt} – ${data.checkIn.closesAt}` : "",
    reference ?? "",
  ].filter(Boolean);
  const captionKey = qrCaption.join("|");
  const pictureKey = `${qrSvg ?? ""}#${captionKey}`;
  // Only the picture of the code on screen now (a new code makes a new one).
  const qrPng = qrPicture?.key === pictureKey ? qrPicture.blob : null;
  useEffect(() => {
    let live = true;
    if (!qrSvg) return;
    buildQrPng(qrSvg, captionKey.split("|"))
      .then((blob) => {
        if (live) setQrPicture({ key: `${qrSvg}#${captionKey}`, blob });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [qrSvg, captionKey]);

  const fetchPayload = useCallback(async (): Promise<{ payload: Payload | null; network: boolean }> => {
    try {
      const res = await fetch(`${base}${q}`, { cache: "no-store" });
      return { payload: res.ok ? ((await res.json()) as Payload) : null, network: false };
    } catch {
      // fetch rejects only when nothing came back: no connection.
      return { payload: null, network: true };
    }
  }, [base, q]);
  // What the kept copy of the page shows (the server's payload, at first).
  const keptShows = useRef(shown(initial));
  const apply = useCallback(({ payload, network }: { payload: Payload | null; network: boolean }) => {
    if (payload) {
      setData(payload);
      setAsOf(new Date().toISOString());
      const now = shown(payload);
      if (now !== keptShows.current) {
        keptShows.current = now;
        refreshKeptBookingPage();
      }
    }
    setFailed(!payload);
    setOffline(network);
  }, []);
  const load = useCallback(async () => apply(await fetchPayload()), [apply, fetchPayload]);

  useEffect(() => {
    let live = true;
    // Rendered just now with a payload: nothing to refresh. Otherwise this
    // may be a copy the phone kept, or the server could not build it.
    // The browser saying it is offline also asks: the attempt fails at once
    // and the note says this is a saved copy.
    const fresh = !!initial && !!savedAt && Math.abs(Date.now() - Date.parse(savedAt)) < FRESH_MS;
    if (!fresh || !navigator.onLine) {
      void fetchPayload().then((p) => {
        if (live) apply(p);
      });
    }
    // Back online: one refresh per "online" event the browser fires.
    const back = () => {
      void fetchPayload().then((p) => {
        if (live) apply(p);
      });
    };
    window.addEventListener("online", back);
    return () => {
      live = false;
      window.removeEventListener("online", back);
    };
    // The props are the page's first render; they do not change after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPayload, apply]);

  const pending = !!data && [data.visitorAccess.holder, ...data.visitorAccess.guests].some((p) => p && (p.state === "pending" || p.state === "withdrawing"));
  useEffect(() => {
    // Offline, polling would only fail; the "online" refresh takes over.
    if (!pending || offline || polls >= POLL_MAX) return;
    const t = setTimeout(() => {
      setPolls((n) => n + 1);
      void load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [pending, offline, data, polls, load]);

  async function act(path: string, method: string, body?: unknown, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${base}${path}${q}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? done ?? null : refusalText(res.status, j.error, en, "حصلت مشكلة، جرّب تاني"));
      setPolls(0);
      await load();
      return res.ok ? j : null;
    } catch {
      setMsg(t("تعذّر الاتصال، جرّب تاني", "Couldn't connect. Try again."));
      return null;
    } finally {
      setBusy(false);
    }
  }

  // The booking page sets the same direction; set here too so the panel
  // reads right wherever it is placed.
  const dir = en ? "ltr" : "rtl";

  if (failed && !data) {
    return (
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 text-sm" dir={dir}>
        {t("مقدرناش نحمّل كود الوصول.", "We couldn't load your check-in code.")}{" "}
        <button className="underline" onClick={() => void load()}>{t("جرّب تاني", "Try again")}</button>
      </div>
    );
  }
  if (!data) return null;
  const { checkIn: c, visitorAccess: va } = data;
  const qrFileName = `maw3ed-check-in-${(reference ?? "booking").replace(/[^A-Za-z0-9-]/g, "")}.png`;
  const savedTime = asOf
    ? new Intl.DateTimeFormat(localeFor(lang), { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(asOf))
    : null;

  return (
    <div className="contents" dir={dir}>
      {offline && (
        <p role="status" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-3 text-xs">
          <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t("مفيش اتصال دلوقتي. ده آخر نسخة اتحفظت", "You're offline. This is the copy saved")}
            {savedTime ? <> {t("", "at ")}<bdi>{savedTime}</bdi></> : null}
            {t(
              " — اعرض الكود على الاستقبال، وهم بيتأكدوا منه لما يقروه.",
              " — show the code at reception; they check it when they scan it.",
            )}
          </span>
        </p>
      )}
      {c.display !== "unavailable" && (
        <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3" aria-labelledby="checkin-h">
          <div className="flex items-center gap-2">
            <QrCode size={18} aria-hidden="true" />
            <h2 id="checkin-h" className="font-bold text-sm">{t("كود تسجيل الوصول", "Check-in code")}</h2>
          </div>
          {c.display === "checked-in" ? (
            <p className="text-sm text-[var(--color-ok)]">
              {t("اتسجّل وصولك", "You're checked in")}
              {c.checkedInAt
                ? `${t(" الساعة ", " at ")}${new Intl.DateTimeFormat(localeFor(lang), { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(c.checkedInAt))}`
                : ""}
              .
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--color-muted)]">
                {t(
                  "اعرضه على الاستقبال لما توصل عشان يسجّلوا وصولك. ده كود الحجز بس — مش تصريح دخول للمول أو الكمبوند.",
                  "Show it at reception when you arrive so they can check you in. This is your booking code only — not an entry pass for the mall or compound.",
                )}
              </p>
              {c.qrSvg && (
                <div
                  className="mx-auto w-60 max-w-full bg-white p-2 rounded-[var(--radius-sm)] border border-[var(--color-line)]"
                  role="img"
                  aria-label={t("كود QR لتسجيل وصولك للحجز. اعرضه على الاستقبال.", "QR code to check in for your booking. Show it at reception.")}
                  // Generated on our server by the qrcode library from our own URL.
                  dangerouslySetInnerHTML={{ __html: c.qrSvg }}
                />
              )}
              <p className="text-xs text-center">
                {c.display === "not-yet" ? t("الكود بيشتغل ", "The code works ") : t("شغّال ", "Works ")}
                <span dir="ltr">{c.opensAt} – {c.closesAt}</span>
              </p>
              {c.qrSvg && (
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1.5"
                    onClick={async () => {
                      // Straight from the tap when the picture is ready (a
                      // share sheet must open from the tap), built now if not.
                      const r = qrPng
                        ? await deliverQrImage(qrPng, qrFileName)
                        : await saveQrImage(c.qrSvg!, { fileName: qrFileName, caption: qrCaption });
                      setMsg(
                        r === "failed"
                          ? t("مقدرناش نحفظ الصورة. خد سكرين شوت للكود.", "Couldn't save the image. Take a screenshot of the code instead.")
                          : r === "cancelled"
                            ? null
                            : t("اتحفظ الكود كصورة — تقدر تفتحه من غير نت.", "Code saved as an image — you can open it without a connection."),
                      );
                    }}
                  >
                    <Download size={14} aria-hidden="true" />
                    {t("احفظ الكود كصورة", "Save QR as image")}
                  </button>
                  <p className="m-0 text-[0.7rem] text-[var(--color-muted)]">
                    {t("عشان يفضل معاك لو النت فصل.", "So you have it even without a connection.")}
                  </p>
                </div>
              )}
              <p className="text-[0.7rem] text-[var(--color-muted)]">
                {t(
                  `لو الكود مش بيتقري، قول اسمك (${customerName}) ورقم الحجز للاستقبال.`,
                  `If the code won't scan, give reception your name (${customerName}) and booking number.`,
                )}
              </p>
              {confirmNewCode ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span>{t("الكود الحالي هيبطل يشتغل خالص. متأكد؟", "Your current code will stop working for good. Are you sure?")}</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setConfirmNewCode(false);
                      void act("/check-in", "POST", undefined, t("اتعمل كود جديد، والقديم بطل يشتغل.", "New code made. The old one no longer works."));
                    }}
                  >
                    {t("أيوه، اعمل كود جديد", "Yes, make a new code")}
                  </button>
                  <button type="button" className="underline" onClick={() => setConfirmNewCode(false)}>{t("لأ", "No")}</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs underline text-[var(--color-muted)]"
                  disabled={busy}
                  onClick={() => setConfirmNewCode(true)}
                >
                  <RefreshCw size={12} className="inline me-1" aria-hidden="true" />
                  {t("حد تاني شاف الكود؟ اعمل كود جديد", "Someone else saw the code? Make a new one")}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {va.offered && va.venue && (
        <section className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-line)] p-5 space-y-3" aria-labelledby="pass-h">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} aria-hidden="true" />
            <h2 id="pass-h" className="font-bold text-sm">{t(`تصريح دخول ${va.venue.name}`, `${va.venue.name} visitor pass`)}</h2>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            {t(
              `تصريح منفصل عن كود الحجز. بيصدر من نظام دخول ${va.venue.name}، ومش بيبقى صالح غير لما النظام ده يوافق عليه.`,
              `Separate from your booking code. It is issued by ${va.venue.name}'s access system, and is only valid once that system approves it.`,
            )}
          </p>
          {va.sandbox && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--color-warn-soft)] px-3 py-2 text-xs font-bold text-[var(--color-warn)]">
              {t("بيئة تجريبية: التصاريح هنا مش صالحة عند أي بوابة حقيقية.", "Test environment: passes here are not valid at any real gate.")}
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
              cta={t("اطلب تصريح دخول", "Request a visitor pass")}
              onSubmit={(v) => act("/pass", "POST", v, t("اتطلب التصريح.", "Pass requested."))}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">{va.eligibility.reason ?? t("التصريح مش متاح للحجز ده دلوقتي.", "A pass is not available for this booking right now.")}</p>
          )}

          {va.holder && va.guestLimit > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
              <p className="text-xs font-bold">{t(`المرافقين (${va.guests.length} من ${va.guestLimit})`, `Guests (${va.guests.length} of ${va.guestLimit})`)}</p>
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
                          // No clipboard (an in-app browser, plain http): show the link to copy by hand.
                          if (!navigator.clipboard) return setMsg(url);
                          void navigator.clipboard.writeText(url).then(() => setMsg(t(`اتنسخ رابط ${g.displayName}. ابعته له.`, `${g.displayName}'s link is copied. Send it to them.`)), () => setMsg(url));
                        }}
                      >
                        {t("انسخ رابط التصريح", "Copy pass link")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label={t(`شيل ${g.displayName}`, `Remove ${g.displayName}`)}
                      disabled={busy}
                      onClick={() => void act(`/guests/${g.guestId}`, "DELETE", undefined, t("اتشال، وتصريحه اتلغى.", "Removed, and their pass cancelled."))}
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
                  cta={t("ضيف مرافق", "Add a guest")}
                  icon
                  onSubmit={(v) => act("/guests", "POST", v, t("اتضاف. انسخ رابطه وابعته له.", "Added. Copy their link and send it to them."))}
                />
              )}
            </div>
          )}
          {pending && polls >= POLL_MAX && (
            <button type="button" className="btn btn-outline btn-sm w-full" onClick={() => { setPolls(0); void load(); }}>
              {t("شوف الحالة تاني", "Check status again")}
            </button>
          )}
        </section>
      )}
      {msg && <p className="text-sm text-center" role="status">{msg}</p>}
    </div>
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
  const { lang } = useLanguage();
  const t = (ar: string, e: string) => (lang === "en" ? e : ar);
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
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("الاسم زي ما في البطاقة", "Name as on your ID")} aria-label={t("الاسم", "Name")} required minLength={2} maxLength={80} />
      {phoneMode !== "none" && (
        <input
          className={field}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={phoneMode === "optional" ? t("رقم الموبايل (لو مختلف عن رقم الحجز)", "Mobile number (if not the booking's)") : t("رقم الموبايل", "Mobile number")}
          aria-label={t("رقم الموبايل", "Mobile number")}
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
