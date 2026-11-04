"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { CalendarClock, CheckCircle, Clock, Hourglass, Loader2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { clock12, dateLong } from "@/lib/fmt";
import { localName } from "@/lib/lang";

type Status = "WAITING" | "OFFERED" | "BOOKED" | "EXPIRED" | "CANCELLED";

interface Entry {
  status: Status;
  date: string;
  fromTime: string;
  toTime: string;
  offer: { time: string; token: string; expiresAt: string } | null;
  business: { nameAr: string; nameEn: string | null; slug: string };
  bookingToken: string | null;
}

/** What the accept route's refusal codes mean, in both languages. */
function refusal(code: string | undefined, fallback: string | undefined, en: boolean): string {
  switch (code) {
    case "expired":
      return en ? "This offer has ended. We'll let you know if another time frees up." : "العرض ده انتهى. هنبعتلك لو فضي ميعاد تاني.";
    case "taken":
      return en ? "Someone booked that time just before you. You're still on the waitlist." : "للأسف حد حجز الميعاد ده قبلك. لسه في قائمة الانتظار.";
    case "call-business":
      return en ? "Please call the business to book this time." : "كلّم المكان عشان تحجز الميعاد ده.";
    case "not-found":
      return en ? "This link isn't valid any more." : "الرابط ده مبقاش صالح.";
    default:
      return (!en && fallback) || (en ? "Something went wrong. Try again." : "حصلت مشكلة، جرّب تاني.");
  }
}

type Read = { state: "ready" | "missing" | "failed"; entry: Entry | null };

/** One read of the link: what it stands at, or why it could not be read. */
async function readEntry(url: string): Promise<Read> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return { state: "missing", entry: null };
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return { state: "failed", entry: null };
    return { state: "ready", entry: (data.data ?? data) as Entry };
  } catch {
    return { state: "failed", entry: null };
  }
}

/** "4:59" / "1:04:59", counting down to `until`. */
function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * The waitlist link itself: a time on offer to take before it runs out,
 * a place still waiting to leave, or where it ended up.
 */
export default function WaitlistEntry({ token }: { token: string }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const en = lang === "en";
  const say = (ar: string, english: string) => (en ? english : ar);

  const url = `/api/public/booking-waitlist/${encodeURIComponent(token)}`;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  const [busy, setBusy] = useState<"accept" | "leave" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const apply = useCallback((r: Read) => {
    setState(r.state);
    if (r.entry) setEntry(r.entry);
  }, []);

  const load = useCallback(async () => apply(await readEntry(url)), [url, apply]);

  useEffect(() => {
    // The first read of the link; later reads follow each action.
    let stale = false;
    readEntry(url).then((r) => {
      if (!stale) apply(r);
    });
    return () => {
      stale = true;
    };
  }, [url, apply]);

  // The countdown ticks once a second while there is an offer, and the
  // page asks again once it has run out, so what is shown is what holds.
  const expiresAt = entry?.offer ? Date.parse(entry.offer.expiresAt) : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= expiresAt) {
        window.clearInterval(id);
        void load();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, load]);

  async function accept() {
    if (!entry?.offer) return;
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerToken: entry.offer.token }),
      });
      const data = await res.json().catch(() => null);
      const body = data?.data ?? data;
      if (res.ok && body?.bookingUrl) {
        router.push(body.bookingUrl as string);
        return;
      }
      setError(refusal(data?.code, data?.error, en));
      await load();
    } catch {
      setError(say("معرفناش نوصل للسيرفر، اتأكد من النت وجرّب تاني", "Couldn't reach the server. Check your connection and try again."));
    } finally {
      setBusy(null);
    }
  }

  async function leave() {
    setBusy("leave");
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(refusal(data?.code, data?.error, en));
      }
      setConfirmLeave(false);
      await load();
    } catch {
      setError(say("معرفناش نوصل للسيرفر، اتأكد من النت وجرّب تاني", "Couldn't reach the server. Check your connection and try again."));
    } finally {
      setBusy(null);
    }
  }

  if (state === "loading") {
    return (
      <div className="card flex items-center justify-center gap-2 p-8" role="status">
        <Loader2 size={20} className="animate-spin text-[var(--color-jade)]" aria-hidden="true" />
        <span className="text-sm text-[var(--color-subtle)]">{say("جارٍ التحميل…", "Loading…")}</span>
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="card p-6 text-center">
        <XCircle size={32} className="mx-auto mb-3 text-[var(--color-subtle)]" aria-hidden="true" />
        <h1 className="m-0 text-lg font-bold text-[var(--color-ink)]">{say("الرابط ده مش موجود", "This link doesn't exist")}</h1>
        <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-subtle)]">
          {say(
            "ممكن يكون الرابط ناقص أو اتنسخ غلط. افتحه تاني من الإيميل أو من إشعارات حسابك.",
            "It may be incomplete or copied wrongly. Open it again from the email or from your account notifications.",
          )}
        </p>
        <Link href="/" className="btn btn-outline mt-5 inline-flex">
          {say("الصفحة الرئيسية", "Home")}
        </Link>
      </div>
    );
  }

  if (state === "failed" || !entry) {
    return (
      <div className="card p-6 text-center">
        <p className="m-0 text-sm text-[var(--color-danger)]">
          {say("معرفناش نحمّل قائمة الانتظار.", "Couldn't load your waitlist request.")}
        </p>
        <button type="button" onClick={() => { setState("loading"); void load(); }} className="btn btn-outline mt-4">
          {say("جرّب تاني", "Try again")}
        </button>
      </div>
    );
  }

  const businessName = localName(en, entry.business.nameAr, entry.business.nameEn);
  // Midday UTC, so the day shown is the day stored in any time zone.
  const day = dateLong(new Date(`${entry.date}T12:00:00Z`), lang);
  const windowText = `${clock12(entry.fromTime, lang)} – ${clock12(entry.toTime, lang)}`;
  const remaining = expiresAt !== null ? expiresAt - now : 0;

  return (
    <>
      <div className="card p-6">
        <p className="m-0 text-xs font-semibold text-[var(--color-subtle)]">{say("قائمة الانتظار", "Waitlist")}</p>
        <h1 className="m-0 mt-1 text-lg font-bold text-[var(--color-ink)]">{businessName}</h1>
        <dl className="m-0 mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-[var(--color-subtle)]">
              <CalendarClock size={15} aria-hidden="true" /> {say("اليوم", "Day")}
            </dt>
            <dd className="m-0 text-end font-semibold text-[var(--color-ink)]">{day}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-[var(--color-subtle)]">
              <Clock size={15} aria-hidden="true" /> {say("الوقت المناسب ليك", "Your window")}
            </dt>
            <dd className="m-0 text-end font-semibold text-[var(--color-ink)]">{windowText}</dd>
          </div>
        </dl>
      </div>

      {/* ── A time on offer ── */}
      {entry.status === "OFFERED" && entry.offer && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-jade-line)] bg-[var(--color-jade-tint)] p-6">
          <h2 className="m-0 text-base font-bold text-[var(--color-ink)]">{say("فضي ميعاد ليك!", "A time has freed up for you!")}</h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {say(
              `${clock12(entry.offer.time, lang)} يوم ${day}. الميعاد محجوزلك لفترة قصيرة، احجزه قبل ما الوقت يخلص.`,
              `${clock12(entry.offer.time, lang)} on ${day}. It's held for you for a short while — book it before the time runs out.`,
            )}
          </p>
          <p className="m-0 mt-4 flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <Hourglass size={16} aria-hidden="true" className="text-[var(--color-jade)]" />
            {say("فاضل", "Time left")}:
            <span role="timer" className="num text-lg font-extrabold text-[var(--color-jade)]" dir="ltr">
              {countdown(remaining)}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void accept()}
            disabled={busy !== null || remaining <= 0}
            className="btn btn-primary mt-5 w-full"
          >
            {busy === "accept" ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" /> {say("جارٍ الحجز…", "Booking…")}
              </>
            ) : (
              say(`احجز ${clock12(entry.offer.time, lang)}`, `Book ${clock12(entry.offer.time, lang)}`)
            )}
          </button>
        </div>
      )}

      {/* ── Still waiting ── */}
      {entry.status === "WAITING" && (
        <div className="card p-6">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
            <Hourglass size={17} aria-hidden="true" className="text-[var(--color-jade)]" />
            {say("إنت في قائمة الانتظار", "You're on the waitlist")}
          </h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {say(
              "لو ميعاد فضي في الوقت اللي اخترته، هنعرضه عليك على إيميلك وفي حسابك لو عندك حساب. الأسبقية للي طلب الأول، والعرض بيفضل متاح لفترة قصيرة بس.",
              "If a time frees up in your window, we'll offer it to you by email, and in your account if you have one. Requests are offered in order, oldest first, and each offer is held only for a short while.",
            )}
          </p>

          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              disabled={busy !== null}
              className="btn btn-outline mt-5 w-full"
            >
              {say("اخرج من قائمة الانتظار", "Leave the waitlist")}
            </button>
          ) : (
            <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] p-4">
              <p className="m-0 text-sm font-bold text-[var(--color-danger)]">
                {say("متأكد؟ هتخسر مكانك في الدور.", "Are you sure? You'll lose your place in line.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void leave()}
                  disabled={busy !== null}
                  className="btn btn-sm bg-[var(--color-danger)] text-[var(--color-inverse)]"
                >
                  {busy === "leave" && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                  {say("أيوه، اخرج", "Yes, leave")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  disabled={busy !== null}
                  className="btn btn-outline btn-sm"
                >
                  {say("لا، خليني", "No, keep my place")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Booked ── */}
      {entry.status === "BOOKED" && (
        <div className="card p-6">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-[var(--color-ok)]">
            <CheckCircle size={18} aria-hidden="true" />
            {say("اتحجزلك ميعاد من قائمة الانتظار", "You booked a time from the waitlist")}
          </h2>
          {entry.bookingToken && (
            <Link href={`/booking/${entry.bookingToken}`} className="btn btn-primary mt-5 inline-flex w-full justify-center">
              {say("عرض الحجز", "View your booking")}
            </Link>
          )}
        </div>
      )}

      {/* ── Ended ── */}
      {(entry.status === "EXPIRED" || entry.status === "CANCELLED") && (
        <div className="card p-6">
          <h2 className="m-0 text-base font-bold text-[var(--color-ink)]">
            {entry.status === "CANCELLED"
              ? say("إنت خرجت من قائمة الانتظار", "You've left the waitlist")
              : say("طلب الانتظار ده انتهى", "This waitlist request has ended")}
          </h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {say("تقدر تشوف المواعيد المتاحة وتحجز من صفحة المكان.", "You can see the open times and book from the business's page.")}
          </p>
          <Link href={`/company/${entry.business.slug}#booking`} className="btn btn-outline mt-5 inline-flex w-full justify-center">
            {say("شوف المواعيد المتاحة", "See open times")}
          </Link>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="pt-2 text-center">
        <Link href={`/company/${entry.business.slug}`} className="text-sm text-[var(--color-brand)] hover:underline">
          {say(`عرض صفحة ${businessName}`, `View ${businessName}'s page`)}
        </Link>
      </div>
    </>
  );
}
