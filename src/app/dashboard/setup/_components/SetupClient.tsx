"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, Eye, EyeOff, Rocket, ShieldCheck, Mail, Phone, Store, HelpCircle } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Toggle from "@/components/ui/Toggle";
import ResendVerificationButton from "@/app/verify-email/_components/ResendVerificationButton";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Readiness } from "@/lib/business/readiness";
import type { VerificationStates } from "@/lib/business-verification";

interface Policies {
  autoConfirm: boolean;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  sameDayCutoff: string | null;
  cancellationCutoffHours: number;
  reviewed: boolean;
}

interface Props {
  slug: string;
  readiness: Readiness;
  verification: VerificationStates;
  isPublished: boolean;
  publishRequested: boolean;
  status: string;
  email: string | null;
  testBookings: number;
  policies: Policies;
}

export default function SetupClient(p: Props) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const router = useRouter();
  const r = p.readiness;
  const blocked = p.status === "SUSPENDED" || p.status === "REJECTED";

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function publish(action: "publish" | "unpublish") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/business/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (res.ok) {
        setMessage({
          tone: "ok",
          text:
            action === "publish"
              ? en ? "Your page is live. Customers can find and book you now." : "صفحتك اتنشرت. العملاء يقدروا يلاقوك ويحجزوا دلوقتي."
              : en ? "Your page is hidden. Existing bookings are kept." : "صفحتك اتخفت. الحجوزات اللي موجودة زي ما هي.",
        });
      } else if (json.code === "waiting-for-email") {
        setMessage({
          tone: "warn",
          text: en
            ? "Everything else is ready. Open the link in your email and the page goes live by itself."
            : json.error ?? "",
        });
      } else {
        setMessage({ tone: "warn", text: en ? "Some required items are still missing — see the list above." : json.error ?? "" });
      }
      router.refresh();
    } catch {
      setMessage({ tone: "warn", text: en ? "Could not reach the server. Try again." : "مقدرناش نوصل للسيرفر. جرّب تاني." });
    } finally {
      setBusy(false);
    }
  }

  const statusLine = blocked
    ? en ? "Suspended by Maw3ed — contact support." : "موقوفة من الإدارة — كلّم الدعم."
    : p.isPublished
      ? en ? "Live — customers can see and book your page." : "منشورة — العملاء شايفين صفحتك وبيحجزوا."
      : p.publishRequested && r.missing.length === 1 && r.missing[0] === "email"
        ? en ? "Waiting for your email confirmation, then it goes live." : "مستنية تأكيد إيميلك، وبعدها تتنشر لوحدها."
        : en ? "Private — only you can see your page." : "خاصة — الصفحة ظاهرة ليك بس.";

  const required = r.items.filter((i) => i.level === "required");
  const recommended = r.items.filter((i) => i.level === "recommended");

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-2">
        <h1 className="m-0 text-[1.625rem] font-black tracking-tight text-[var(--color-ink)]">
          {en ? "Set up your business" : "تجهيز النشاط"}
        </h1>
        <p className="m-0 text-sm text-[var(--color-muted)]">{statusLine}</p>
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]"
          role="progressbar"
          aria-valuenow={r.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={en ? "Setup progress" : "تقدّم التجهيز"}
        >
          <div className="h-full bg-[var(--color-jade)] transition-all" style={{ width: `${r.percent}%` }} />
        </div>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en
            ? `${r.requiredDone} of ${r.requiredTotal} required steps done · ${r.percent}% overall`
            : `${r.requiredDone} من ${r.requiredTotal} خطوات مطلوبة · ${r.percent}% إجمالي`}
        </p>
      </header>

      <section className="card p-5 space-y-3" aria-labelledby="req-h">
        <h2 id="req-h" className="m-0 text-base font-extrabold">
          {en ? "Required before publishing" : "مطلوب قبل النشر"}
        </h2>
        <Checklist items={required} en={en} />
      </section>

      <section className="card p-5 space-y-3" aria-labelledby="rec-h">
        <h2 id="rec-h" className="m-0 text-base font-extrabold">
          {en ? "Recommended" : "مستحسن"}
        </h2>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en ? "These never block publishing, but customers trust complete pages more." : "دول مش بيمنعوا النشر، بس العملاء بيثقوا في الصفحة الكاملة أكتر."}
        </p>
        <Checklist items={recommended} en={en} />
      </section>

      <section id="email" className="card p-5 space-y-3" aria-labelledby="ver-h">
        <h2 id="ver-h" className="m-0 text-base font-extrabold">{en ? "Verification" : "التحقق"}</h2>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en
            ? "Each check is separate. Confirming your email or phone proves you can be reached — it does not make your business \"verified\"."
            : "كل تحقق لوحده. تأكيد الإيميل أو التليفون معناه إننا نقدر نوصلك — مش معناه إن نشاطك \"موثّق\"."}
        </p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          <VerifyRow icon={Mail} done={p.verification.email} en={en}
            label={en ? "Email confirmed" : "الإيميل متأكد"}
            note={p.email ? <span dir="ltr">{p.email}</span> : null} />
          <VerifyRow icon={Phone} done={p.verification.phone} en={en}
            label={en ? "Phone / WhatsApp confirmed" : "التليفون / واتساب متأكد"}
            note={!p.verification.phone ? <Link href="/dashboard/settings" className="underline">{en ? "Confirm in settings" : "أكّده من الإعدادات"}</Link> : null} />
          <VerifyRow icon={ShieldCheck} done={p.verification.identity.verified} en={en}
            label={en ? "Ownership checked by Maw3ed" : "موعد اتأكد من صاحب النشاط"}
            note={en ? "Done by our team from evidence you send to support. This is what shows the Verified badge." : "بيعمله فريقنا من مستندات بتبعتها للدعم. ده اللي بيظهر علامة \"موثّق\"."} />
          <VerifyRow icon={Store} done={false} en={en} notApplicable
            label={en ? "Venue check" : "التحقق من المكان"}
            note={en ? "Not offered yet." : "مش متاح لسه."} />
        </ul>
        {!p.verification.email && p.email ? (
          <div className="max-w-sm">
            <ResendVerificationButton />
          </div>
        ) : null}
      </section>

      <PoliciesForm initial={p.policies} en={en} onSaved={() => router.refresh()} />

      <section id="test" className="card p-5 space-y-3" aria-labelledby="test-h">
        <h2 id="test-h" className="m-0 text-base font-extrabold">{en ? "Try a test booking" : "جرّب حجز تجريبي"}</h2>
        <p className="m-0 text-sm text-[var(--color-muted)]">
          {p.isPublished
            ? en ? "Your page is live, so bookings made on it are real." : "صفحتك منشورة، فأي حجز عليها حجز حقيقي."
            : en
              ? "Open your page as a customer would and book something. It runs through the real booking system, but no customer is created, nothing is sent, and it does not count toward your limits. Test bookings are deleted when you publish."
              : "افتح صفحتك زي العميل واحجز. الحجز بيمشي في نظام الحجز الحقيقي، بس مفيش عميل بيتسجل، ومفيش رسايل بتتبعت، ومش بيتحسب من حدود باقتك. الحجوزات التجريبية بتتمسح لما تنشر."}
        </p>
        {!p.isPublished && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/company/${p.slug}`} target="_blank" className="btn btn-outline gap-2">
              <ExternalLink size={16} aria-hidden="true" />
              {en ? "Open preview" : "افتح المعاينة"}
            </Link>
            <span className="text-xs text-[var(--color-subtle)]">
              {en ? `${p.testBookings} test booking(s) so far` : `حجوزات تجريبية لحد دلوقتي: ${p.testBookings}`}
            </span>
          </div>
        )}
      </section>

      <section className="card p-5 space-y-3" aria-labelledby="pub-h">
        <h2 id="pub-h" className="m-0 text-base font-extrabold">{en ? "Publish" : "النشر"}</h2>
        {!p.isPublished && !r.canPublish && (
          <p className="m-0 text-sm text-[var(--color-muted)]">
            {en ? "Finish the required items above to publish." : "خلّص الحاجات المطلوبة اللي فوق عشان تنشر."}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {p.isPublished ? (
            <button type="button" className="btn btn-outline gap-2" disabled={busy} onClick={() => publish("unpublish")}>
              <EyeOff size={16} aria-hidden="true" />
              {en ? "Hide my page" : "اخفي صفحتي"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={busy || blocked}
              onClick={() => publish("publish")}
            >
              <Rocket size={16} aria-hidden="true" />
              {en ? "Publish my page" : "انشر صفحتي"}
            </button>
          )}
          {p.isPublished && (
            <Link href={`/company/${p.slug}`} target="_blank" className="btn btn-ghost gap-2">
              <Eye size={16} aria-hidden="true" />
              {en ? "View page" : "شوف الصفحة"}
            </Link>
          )}
          <Link href="/help/getting-started" className="btn btn-ghost gap-2">
            <HelpCircle size={16} aria-hidden="true" />
            {en ? "Setup guide" : "دليل التجهيز"}
          </Link>
        </div>
        <p role="status" className={`m-0 min-h-5 text-sm ${message?.tone === "ok" ? "text-[var(--color-ok)]" : "text-[var(--color-warn,#b45309)]"}`}>
          {message?.text}
        </p>
      </section>
    </div>
  );
}

function Checklist({ items, en }: { items: Readiness["items"]; en: boolean }) {
  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {items.map((i) => (
        <li key={i.key} className="flex items-start gap-3 rounded-[var(--radius-md)] px-2 py-2 hover:bg-[var(--color-surface-2)]">
          {i.done ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--color-jade)]" aria-label={en ? "Done" : "تم"} />
          ) : (
            <Circle size={18} className="mt-0.5 shrink-0 text-[var(--color-subtle)]" aria-label={en ? "Not done" : "لسه"} />
          )}
          <div className="min-w-0 flex-1">
            <p className={`m-0 text-sm ${i.done ? "text-[var(--color-muted)]" : "font-bold text-[var(--color-ink)]"}`}>
              {en ? i.en : i.ar}
            </p>
            {!i.done && (i.whyAr || i.whyEn) ? (
              <p className="m-0 text-xs text-[var(--color-subtle)]">{en ? i.whyEn : i.whyAr}</p>
            ) : null}
          </div>
          {!i.done && (
            <Link href={i.href} className="shrink-0 text-xs font-bold text-[var(--color-jade)] underline-offset-2 hover:underline">
              {en ? "Fix" : "كمّل"}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function VerifyRow({
  icon: Icon,
  done,
  label,
  note,
  en,
  notApplicable = false,
}: {
  icon: typeof Mail;
  done: boolean;
  label: string;
  note: React.ReactNode;
  en: boolean;
  notApplicable?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="m-0 text-sm font-bold">{label}</p>
        <p className="m-0 text-xs">
          {notApplicable ? (
            <span className="text-[var(--color-subtle)]">{en ? "Not applicable" : "لا ينطبق"}</span>
          ) : done ? (
            <span className="text-[var(--color-ok)]">{en ? "Done" : "تم"}</span>
          ) : (
            <span className="text-[var(--color-subtle)]">{en ? "Not yet" : "لسه"}</span>
          )}
        </p>
        {note ? <p className="m-0 text-xs text-[var(--color-subtle)]">{note}</p> : null}
      </div>
    </li>
  );
}

function PoliciesForm({ initial, en, onSaved }: { initial: Policies; en: boolean; onSaved: () => void }) {
  const [v, setV] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function num(key: keyof Policies, value: string) {
    const n = Number(value);
    setV((prev) => ({ ...prev, [key]: Number.isFinite(n) ? Math.trunc(n) : 0 }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/business/settings/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoConfirm: v.autoConfirm,
          minNoticeMinutes: v.minNoticeMinutes,
          maxAdvanceDays: v.maxAdvanceDays,
          bufferMinutes: v.bufferMinutes,
          sameDayCutoff: v.sameDayCutoff || null,
          cancellationCutoffHours: v.cancellationCutoffHours,
          reviewed: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState("error");
        setError(json.error ?? (en ? "Could not save." : "مقدرناش نحفظ."));
        return;
      }
      setState("saved");
      onSaved();
    } catch {
      setState("error");
      setError(en ? "Could not reach the server." : "مقدرناش نوصل للسيرفر.");
    }
  }

  const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

  return (
    <form id="policies" onSubmit={save} className="card p-5 space-y-4" aria-labelledby="pol-h">
      <div className="space-y-1">
        <h2 id="pol-h" className="m-0 text-base font-extrabold">{en ? "Booking & cancellation policies" : "سياسات الحجز والإلغاء"}</h2>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en
            ? "These are your promise to customers. They are shown on your page and in booking emails. Save once to confirm you have reviewed them."
            : "دي وعدك للعملاء. بتظهر في صفحتك وفي إيميلات الحجز. احفظ مرة عشان تأكد إنك راجعتها."}
        </p>
      </div>

      <Toggle
        label={en ? "Confirm online bookings automatically" : "تأكيد الحجوزات الأونلاين تلقائيًا"}
        hint={en ? "Off: each booking waits for you to confirm it." : "مقفول: كل حجز بيستناك تأكده."}
        checked={v.autoConfirm}
        onChange={(next) => setV((prev) => ({ ...prev, autoConfirm: next }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Minimum notice (minutes)" : "أقل وقت قبل الحجز (بالدقايق)"}</span>
          <input type="number" min={0} max={10080} className={field} value={v.minNoticeMinutes}
            onChange={(e) => num("minNoticeMinutes", e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Book up to (days ahead)" : "الحجز لحد (يوم قدام)"}</span>
          <input type="number" min={1} max={365} className={field} value={v.maxAdvanceDays}
            onChange={(e) => num("maxAdvanceDays", e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Gap after each appointment (minutes)" : "استراحة بعد كل ميعاد (بالدقايق)"}</span>
          <input type="number" min={0} max={240} className={field} value={v.bufferMinutes}
            onChange={(e) => num("bufferMinutes", e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Stop same-day bookings after" : "وقف حجز نفس اليوم بعد"}</span>
          <input type="time" className={field} value={v.sameDayCutoff ?? ""} dir="ltr"
            onChange={(e) => setV((prev) => ({ ...prev, sameDayCutoff: e.target.value || null }))} />
          <span className="block text-xs text-[var(--color-subtle)]">{en ? "Leave empty for no cutoff." : "سيبه فاضي لو مفيش."}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Customers may cancel or move up to (hours before)" : "العميل يقدر يلغي أو يغيّر لحد (ساعة قبل الميعاد)"}</span>
          <input type="number" min={0} max={168} className={field} value={v.cancellationCutoffHours}
            onChange={(e) => num("cancellationCutoffHours", e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={state === "saving"}>
          {initial.reviewed
            ? en ? "Save policies" : "احفظ السياسات"
            : en ? "I've reviewed these — save" : "راجعتها — احفظ"}
        </button>
        <span role="status" className="text-xs">
          {state === "saved" && <span className="text-[var(--color-ok)]">{en ? "Saved." : "اتحفظت."}</span>}
          {state === "error" && <span className="text-[var(--color-danger,#b91c1c)]">{error}</span>}
        </span>
      </div>
    </form>
  );
}
