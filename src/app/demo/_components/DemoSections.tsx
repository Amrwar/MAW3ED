"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import QRCode from "qrcode";
import { Star, Copy, Check, BellRing, CheckCircle2, Clock3, Wallet, MessageSquare, Plus } from "lucide-react";
import {
  DEMO_BUSINESS, REMINDER_LEAD_CHOICES, clockOf, demoAddOffer, demoBook, demoOverview, demoReply,
  demoReport, demoSetSettings, demoSetStatus, demoSlots, demoToggleOffer, serviceOf,
  type DemoState, type DemoStatus,
} from "@/lib/demo/workspace";
import { coverClassFor } from "@/lib/category-cover";
import type { Tab } from "./DemoClient";

type SetState = Dispatch<SetStateAction<DemoState>>;

const STATUS: Record<DemoStatus, { ar: string; en: string; cls: string }> = {
  PENDING:   { ar: "مستني تأكيد", en: "Pending",   cls: "badge-warning" },
  CONFIRMED: { ar: "متأكد",       en: "Confirmed", cls: "badge-accent" },
  COMPLETED: { ar: "خلص",         en: "Completed", cls: "badge-success" },
  NO_SHOW:   { ar: "محضرش",       en: "No-show",   cls: "badge-danger" },
  CANCELLED: { ar: "اتلغى",       en: "Cancelled", cls: "badge-default" },
};

const panel = "rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] border border-[var(--color-line)]";
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-sm";
const egp = (n: number, en: boolean) => (en ? `${n} EGP` : `${n} ج.م`);
/** "1 visit", "2 visits": English counts read right at one and above. */
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/* ── Overview ─────────────────────────────────────────────────── */

export function Overview({ state, en, setState, go }: { state: DemoState; en: boolean; setState: SetState; go: (t: Tab) => void }) {
  const o = demoOverview(state);
  const tiles = [
    { Icon: CheckCircle2, ar: "حجوزات النهارده", en: "Bookings today", v: String(o.today) },
    { Icon: Clock3, ar: "مستنية تأكيدك", en: "Waiting for you", v: String(o.pending) },
    { Icon: Wallet, ar: "إيراد متوقع النهارده", en: "Expected today", v: egp(o.expected, en) },
    { Icon: Star, ar: "تقييمك", en: "Your rating", v: `${o.rating} ★` },
  ];
  const rows = [...state.bookings].sort((a, b) => a.start - b.start);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.en} className={`${panel} p-4`}>
            <t.Icon size={18} aria-hidden="true" className="text-[var(--color-jade)]" />
            <p className="m-0 mt-2.5 text-xs text-[var(--color-subtle)]">{en ? t.en : t.ar}</p>
            <p className="num m-0 mt-0.5 text-[1.375rem] font-bold text-[var(--color-ink)]">{t.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className={`${panel} divide-y divide-[var(--color-line)]`} aria-label={en ? "Today's appointments" : "مواعيد النهارده"}>
          <h2 className="m-0 px-4 py-3.5 text-[0.9375rem] font-bold">{en ? "Today" : "النهارده"}</h2>
          {rows.map((b) => {
            const svc = serviceOf(state, b.serviceId);
            const st = state.staff.find((s) => s.id === b.staffId);
            const c = state.customers.find((x) => x.id === b.customerId);
            const label = STATUS[b.status];
            const set = (s: DemoStatus) => setState((prev) => demoSetStatus(prev, b.id, s));
            return (
              // Who and when on one line; the actions take a line of their
              // own on a phone, where beside them the name shrank to a word
              // a line.
              <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5">
                <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
                  <span className="num w-14 shrink-0 font-bold" dir="ltr">{clockOf(b.start)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-bold">{en ? c?.en : c?.name}</p>
                    <p className="m-0 truncate text-xs text-[var(--color-subtle)]">{en ? svc?.en : svc?.ar} · {en ? st?.en : st?.ar}</p>
                  </div>
                  <span className={`badge shrink-0 ${label.cls}`}>{en ? label.en : label.ar}</span>
                </div>
                {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                  <div className="flex shrink-0 gap-2 ps-[4.25rem] sm:ps-0">
                    {b.status === "PENDING" && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => set("CONFIRMED")}>{en ? "Confirm" : "أكّد"}</button>
                    )}
                    {b.status === "CONFIRMED" && (
                      <>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => set("COMPLETED")}>{en ? "Mark done" : "خلص"}</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => set("NO_SHOW")}>{en ? "No-show" : "محضرش"}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className={`${panel} space-y-3 p-4`} aria-label={en ? "Needs you" : "محتاجك"}>
          <h2 className="m-0 text-[0.9375rem] font-bold">{en ? "Needs you" : "محتاجك"}</h2>
          {o.pending === 0 && o.unanswered === 0 ? (
            <p className="m-0 text-sm text-[var(--color-muted)]">{en ? "All caught up." : "كله تمام."}</p>
          ) : null}
          {o.pending > 0 && (
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
              {en ? `${n(o.pending, "booking is", "bookings are")} waiting for your confirmation.` : `${o.pending} حجز مستني تأكيدك.`}
            </p>
          )}
          {o.unanswered > 0 && (
            <button type="button" onClick={() => go("reviews")} className="block w-full rounded-[var(--radius-md)] bg-[var(--color-jade-tint)] p-3 text-start text-sm text-[var(--color-jade-hover)]">
              {en ? `${n(o.unanswered, "review", "reviews")} without a reply →` : `${o.unanswered} تقييم من غير رد ←`}
            </button>
          )}
          <button type="button" onClick={() => go("book")} className="btn btn-outline btn-sm w-full gap-1.5">
            <Plus size={15} aria-hidden="true" />{en ? "Add a booking" : "ضيف حجز"}
          </button>
        </section>
      </div>
    </div>
  );
}

/* ── Calendar: today, one column per team member ─────────────── */

const DAY_START = 10 * 60;
const DAY_END = 22 * 60;
const ROW = 22; // px per 30 minutes

export function CalendarView({ state, en }: { state: DemoState; en: boolean }) {
  const hours: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += 60) hours.push(m);
  const height = ((DAY_END - DAY_START) / 30) * ROW;
  const tone: Record<DemoStatus, string> = {
    PENDING: "bg-[var(--color-warn-soft)] border-[var(--color-warn-line)] text-[var(--color-warn)]",
    CONFIRMED: "bg-[var(--color-jade-soft)] border-[var(--color-jade-line)] text-[var(--color-jade-hover)]",
    COMPLETED: "bg-[var(--color-surface-3)] border-[var(--color-line)] text-[var(--color-muted)]",
    NO_SHOW: "bg-[var(--color-danger-soft)] border-[var(--color-line)] text-[var(--color-danger)]",
    CANCELLED: "hidden",
  };
  return (
    <section className={`${panel} overflow-x-auto p-4`} aria-label={en ? "Today's calendar" : "تقويم النهارده"}>
      {/* Wide enough for a readable column each, narrow enough that two
          team members fit a phone without scrolling sideways. */}
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${state.staff.length}, minmax(8.5rem, 1fr))` }}>
        <div />
        {state.staff.map((s) => (
          <p key={s.id} className="m-0 pb-3 text-center text-sm font-bold">{en ? s.en : s.ar}</p>
        ))}
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span key={m} className="num absolute text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr" style={{ top: ((m - DAY_START) / 30) * ROW - 7 }}>
              {clockOf(m)}
            </span>
          ))}
        </div>
        {state.staff.map((s) => (
          <div key={s.id} className="relative border-s border-[var(--color-line)]" style={{ height }}>
            {hours.map((m) => (
              <span key={m} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-[var(--color-line)]" style={{ top: ((m - DAY_START) / 30) * ROW }} />
            ))}
            {state.bookings.filter((b) => b.staffId === s.id).map((b) => {
              const svc = serviceOf(state, b.serviceId);
              const c = state.customers.find((x) => x.id === b.customerId);
              const dur = svc?.duration ?? 30;
              return (
                <div
                  key={b.id}
                  className={`absolute inset-x-1.5 overflow-hidden rounded-[var(--radius-sm)] border px-2 py-1 text-[0.6875rem] leading-tight ${tone[b.status]}`}
                  style={{ top: ((b.start - DAY_START) / 30) * ROW + 1, height: Math.max((dur / 30) * ROW - 2, 18) }}
                >
                  <span className="font-bold" dir="ltr">{clockOf(b.start)}</span> {en ? c?.en : c?.name} · {en ? svc?.en : svc?.ar}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── New booking ─────────────────────────────────────────────── */

export function BookForm({ state, en, setState, go }: { state: DemoState; en: boolean; setState: SetState; go: (t: Tab) => void }) {
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // Today, as the visitor's clock has it. Slots before now are not offered.
  const [{ dow, nowMin }] = useState(() => {
    const d = new Date();
    return { dow: d.getDay(), nowMin: d.getHours() * 60 + d.getMinutes() };
  });
  const { slots } = useMemo(
    () => demoSlots(state, serviceId, staffId, dow, nowMin),
    [state, serviceId, staffId, dow, nowMin],
  );

  return (
    <section className={`${panel} space-y-5 p-5`} aria-label={en ? "New booking" : "حجز جديد"}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-bold">{en ? "Service" : "الخدمة"}</span>
          <select className={field} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {state.services.map((s) => (
              <option key={s.id} value={s.id}>{en ? s.en : s.ar} · {s.duration} {en ? "min" : "دقيقة"} · {egp(s.price, en)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-bold">{en ? "With" : "مع"}</span>
          <select className={field} value={staffId ?? ""} onChange={(e) => setStaffId(e.target.value || null)}>
            <option value="">{en ? "Anyone available" : "أي حد متاح"}</option>
            {state.staff.map((s) => <option key={s.id} value={s.id}>{en ? s.en : s.ar}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-bold">{en ? "Customer name" : "اسم العميل"}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={en ? "Any name, it's a demo" : "أي اسم، دي تجربة"} />
        </label>
      </div>
      <div>
        <p className="m-0 mb-2.5 text-sm font-bold">{en ? "Free times today" : "المواعيد الفاضية النهارده"}</p>
        {slots.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{en ? "No free times left today for this choice." : "مفيش مواعيد فاضية النهارده للاختيار ده."}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                dir="ltr"
                className="btn btn-sm btn-outline num"
                onClick={() => {
                  // Re-checked against the latest state, so a double tap
                  // cannot book the same person twice at one time.
                  setState((prev) => {
                    const fresh = demoSlots(prev, serviceId, staffId, dow, nowMin);
                    if (!fresh.slots.includes(t)) return prev;
                    return demoBook(prev, { serviceId, staffId: staffId ?? fresh.assignments[t] ?? prev.staff[0].id, time: t, customerName: name });
                  });
                  go("overview");
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Customers ───────────────────────────────────────────────── */

export function Customers({ state, en }: { state: DemoState; en: boolean }) {
  return (
    <section className={`${panel} divide-y divide-[var(--color-line)]`} aria-label={en ? "Customers" : "العملاء"}>
      {state.customers.map((c) => {
        const last = [...state.bookings].filter((b) => b.customerId === c.id).sort((a, b) => b.start - a.start)[0];
        const svc = last ? serviceOf(state, last.serviceId) : undefined;
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-sm font-bold text-[var(--color-muted)]">
              {(en ? c.en : c.name).replace(/[^0-9٠-٩]/g, "").slice(-1) || (en ? c.en : c.name).slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-bold">{en ? c.en : c.name}</p>
              <p className="m-0 text-xs text-[var(--color-subtle)]" dir="ltr">{c.phone}</p>
            </div>
            {svc && <span className="text-xs text-[var(--color-muted)]">{en ? `Last: ${svc.en}` : `آخر خدمة: ${svc.ar}`}</span>}
            <span className="badge badge-default">{en ? n(c.visits, "visit", "visits") : `${c.visits} زيارات`}</span>
          </div>
        );
      })}
    </section>
  );
}

/* ── The public page, its link and QR ────────────────────────── */

export function BookingPage({ state, en }: { state: DemoState; en: boolean }) {
  const link = "maw3ed.net/company/sample-salon";
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const o = demoOverview(state);
  useEffect(() => {
    // In the demo the code opens this demo; a real one opens your page.
    QRCode.toDataURL("https://www.maw3ed.net/demo", { margin: 1, width: 360, color: { dark: "#11201C", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className={`${panel} overflow-hidden`} aria-label={en ? "Your booking page" : "صفحة الحجز بتاعتك"}>
        <div className={`h-36 ${coverClassFor("salons")}`} aria-hidden="true" />
        <div className="space-y-4 p-5">
          <div>
            <p className="m-0 text-xl font-bold">{en ? DEMO_BUSINESS.en : DEMO_BUSINESS.ar}</p>
            <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
              <Star size={14} aria-hidden="true" className="fill-[var(--color-star)] text-[var(--color-star)]" />
              {o.rating} · {en ? `${state.reviews.length} reviews · New Cairo` : `${state.reviews.length} تقييمات · القاهرة الجديدة`}
            </p>
          </div>
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] p-0">
            {state.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-semibold">{en ? s.en : s.ar}</span>
                  <span className="block text-xs text-[var(--color-subtle)]">{s.duration} {en ? "min" : "دقيقة"}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="num font-bold">{egp(s.price, en)}</span>
                  <span className="rounded-full bg-[var(--color-jade)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-inverse)]">{en ? "Book" : "احجز"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${panel} space-y-4 p-5`} aria-label={en ? "Share" : "شارك"}>
        <div>
          <p className="m-0 text-sm font-bold">{en ? "Your booking link" : "لينك الحجز بتاعك"}</p>
          <p className="m-0 mt-1 text-xs text-[var(--color-subtle)]">{en ? "Put it on Instagram, WhatsApp and Google Maps." : "حطه على إنستجرام وواتساب وجوجل ماب."}</p>
          <div className="mt-2.5 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1.5 ps-3">
            <span className="min-w-0 flex-1 truncate text-sm" dir="ltr">{link}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1.5"
              onClick={() => {
                // The demo's own address, never a real-looking business
                // page that could 404 or one day be somebody else's.
                navigator.clipboard?.writeText("https://www.maw3ed.net/demo").then(
                  () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
                  () => setCopied(false),
                );
              }}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? (en ? "Copied" : "اتنسخ") : (en ? "Copy" : "انسخ")}
            </button>
          </div>
          <p className="m-0 mt-1.5 text-[0.6875rem] text-[var(--color-subtle)]">{en ? "A sample address: yours carries your business's name. Copying here gives the demo's link." : "عنوان تجريبي: بتاعك بيبقى باسم نشاطك. النسخ هنا بيديك لينك الديمو."}</p>
        </div>
        <div className="border-t border-[var(--color-line)] pt-4 text-center">
          <p className="m-0 text-sm font-bold">{en ? "QR for your counter" : "QR للكاشير"}</p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URL made in this tab
            <img src={qr} alt={en ? "Sample QR code" : "QR تجريبي"} width={168} height={168} className="mx-auto mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-qr-paper)] p-2" />
          ) : (
            <div className="mx-auto mt-3 size-[168px] rounded-[var(--radius-md)] bg-[var(--color-surface-3)]" />
          )}
          <p className="m-0 mt-2 text-[0.6875rem] text-[var(--color-subtle)]">{en ? "Customers scan it and book. This one opens the demo." : "العميل يعمله scan ويحجز. الكود ده بيفتح الديمو."}</p>
        </div>
      </section>
    </div>
  );
}

/* ── Reminders ───────────────────────────────────────────────── */

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--color-jade)]" : "bg-[var(--color-line-2)]"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`} />
    </button>
  );
}

export function Reminders({ state, en, setState }: { state: DemoState; en: boolean; setState: SetState }) {
  const s = state.settings;
  const next = [...state.bookings].filter((b) => b.status === "CONFIRMED").sort((a, b) => a.start - b.start)[0];
  const svc = next ? serviceOf(state, next.serviceId) : state.services[0];
  const at = next ? clockOf(next.start) : "17:00";
  const lead = (h: number) => (en ? (h === 1 ? "1 hour" : `${h} hours`) : h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ساعة`);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className={`${panel} divide-y divide-[var(--color-line)]`} aria-label={en ? "Reminder settings" : "إعدادات التذكير"}>
        <div className="flex items-start gap-4 p-5">
          <div className="flex-1">
            <p className="m-0 font-bold">{en ? "Remind customers automatically" : "فكّر العملاء تلقائي"}</p>
            <p className="m-0 mt-1 text-sm text-[var(--color-muted)]">{en ? "By email, and on WhatsApp on plans that include it." : "بالإيميل، وعلى واتساب في الخطط اللي فيها واتساب."}</p>
          </div>
          <Switch on={s.reminderEnabled} label={en ? "Automatic reminders" : "تذكير تلقائي"} onChange={(v) => setState((p) => demoSetSettings(p, { reminderEnabled: v }))} />
        </div>
        <label className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-5 ${s.reminderEnabled ? "" : "opacity-50"}`}>
          <span className="min-w-[8rem] flex-1 font-bold">{en ? "How long before" : "قبل الموعد بـ"}</span>
          <select
            className="w-auto shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-sm"
            disabled={!s.reminderEnabled}
            value={s.reminderLeadHours}
            onChange={(e) => setState((p) => demoSetSettings(p, { reminderLeadHours: Number(e.target.value) }))}
          >
            {REMINDER_LEAD_CHOICES.map((h) => <option key={h} value={h}>{lead(h)}</option>)}
          </select>
        </label>
        <div className="flex items-start gap-4 p-5">
          <div className="flex-1">
            <p className="m-0 font-bold">{en ? "Confirm online bookings automatically" : "أكّد الحجوزات الأونلاين تلقائي"}</p>
            <p className="m-0 mt-1 text-sm text-[var(--color-muted)]">{en ? "Off: each booking waits for you, and the customer is told either way." : "لو مقفول: كل حجز بيستناك، والعميل بيعرف في الحالتين."}</p>
          </div>
          <Switch on={s.autoConfirm} label={en ? "Auto-confirm" : "تأكيد تلقائي"} onChange={(v) => setState((p) => demoSetSettings(p, { autoConfirm: v }))} />
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] bg-[#E7EFE9] p-4" aria-label={en ? "Message preview" : "شكل الرسالة"}>
        <p className="m-0 mb-3 flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)]">
          <BellRing size={14} aria-hidden="true" />{en ? "What your customer gets" : "اللي بيوصل العميل"}
        </p>
        {s.reminderEnabled ? (
          <div className="max-w-[17rem] rounded-[1rem] rounded-ss-sm bg-white p-3.5 text-sm leading-relaxed shadow-sm">
            <p className="m-0">
              {en
                ? `Reminder: your ${svc?.en} at ${DEMO_BUSINESS.en} is in ${lead(s.reminderLeadHours)}, at ${at}.`
                : `تذكير: ميعاد ${svc?.ar} في ${DEMO_BUSINESS.ar} بعد ${lead(s.reminderLeadHours)}، الساعة ${at}.`}
            </p>
            <p className="m-0 mt-2 text-[var(--color-jade)] underline">{en ? "Change or cancel" : "غيّر أو ألغي"}</p>
            <p className="m-0 mt-1 text-end text-[0.6875rem] text-[var(--color-subtle)]">{en ? "Sample message" : "رسالة تجريبية"}</p>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--color-muted)]">{en ? "Reminders are off: customers get only the confirmation." : "التذكير مقفول: العميل بيوصله التأكيد بس."}</p>
        )}
      </section>
    </div>
  );
}

/* ── Reviews ─────────────────────────────────────────────────── */

export function Reviews({ state, en, setState }: { state: DemoState; en: boolean; setState: SetState }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <section className="space-y-3" aria-label={en ? "Reviews" : "التقييمات"}>
      {state.reviews.map((r) => {
        const c = state.customers.find((x) => x.id === r.customerId);
        return (
          <article key={r.id} className={`${panel} space-y-3 p-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 font-bold">{en ? c?.en : c?.name}</p>
              <span className="flex" aria-label={en ? `${r.rating} of 5` : `${r.rating} من 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} aria-hidden="true" className={n <= r.rating ? "fill-[var(--color-star)] text-[var(--color-star)]" : "text-[var(--color-line-2)]"} />
                ))}
              </span>
              <span className="badge badge-default">{en ? "Verified visit" : "زيارة حقيقية"}</span>
            </div>
            <p className="m-0 text-[0.9375rem] text-[var(--color-ink-2)]">{en ? r.en : r.ar}</p>
            {r.reply ? (
              <div className="rounded-[var(--radius-md)] border-s-2 border-[var(--color-jade)] bg-[var(--color-jade-tint)] p-3 text-sm">
                <p className="m-0 flex items-center gap-1.5 text-xs font-bold text-[var(--color-jade)]">
                  <MessageSquare size={13} aria-hidden="true" />{en ? "Your reply" : "ردك"}
                </p>
                <p className="m-0 mt-1">{r.reply}</p>
              </div>
            ) : (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setState((p) => demoReply(p, r.id, draft[r.id] ?? ""));
                }}
              >
                <label className="sr-only" htmlFor={`reply-${r.id}`}>{en ? "Reply" : "رد"}</label>
                <input
                  id={`reply-${r.id}`}
                  className={`${field} min-w-[12rem] flex-1`}
                  value={draft[r.id] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder={en ? "Write a public reply…" : "اكتب رد يظهر للكل…"}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!(draft[r.id] ?? "").trim()}>{en ? "Reply" : "رد"}</button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}

/* ── Offers ──────────────────────────────────────────────────── */

export function Offers({ state, en, setState }: { state: DemoState; en: boolean; setState: SetState }) {
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const reasons = {
    code: en ? "Type a code of up to 40 characters, like SUMMER15." : "اكتب كود لحد ٤٠ حرف، زي SUMMER15.",
    percent: en ? "Pick a whole percent from 1 to 100." : "اختار نسبة صحيحة من ١ لـ ١٠٠.",
    duplicate: en ? "You already have that code." : "الكود ده موجود عندك.",
  };
  return (
    <div className="space-y-5">
      <form
        className={`${panel} flex flex-wrap items-end gap-3 p-5`}
        onSubmit={(e) => {
          e.preventDefault();
          const r = demoAddOffer(state, code, Number(percent));
          if ("error" in r) return setError(reasons[r.error]);
          // Applied to the latest state, like every other change here.
          setState((p) => {
            const again = demoAddOffer(p, code, Number(percent));
            return "state" in again ? again.state : p;
          });
          setCode(""); setError(null);
        }}
      >
        <label className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
          <span className="font-bold">{en ? "Code" : "الكود"}</span>
          <input className={`${field} uppercase`} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER15" />
        </label>
        <label className="w-32 space-y-1.5 text-sm">
          <span className="font-bold">{en ? "Discount %" : "الخصم ٪"}</span>
          <input className={field} type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary gap-1.5"><Plus size={15} aria-hidden="true" />{en ? "Create code" : "اعمل كود"}</button>
        {error && <p role="alert" className="m-0 w-full text-sm text-[var(--color-danger)]">{error}</p>}
      </form>

      <section className={`${panel} divide-y divide-[var(--color-line)]`} aria-label={en ? "Your codes" : "أكوادك"}>
        {state.offers.map((o) => (
          <div key={o.id} className={`flex flex-wrap items-center gap-3 p-4 ${o.active ? "" : "opacity-60"}`}>
            <span className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-jade)] bg-[var(--color-jade-tint)] px-2.5 py-1 font-mono text-sm font-bold text-[var(--color-jade-hover)]" dir="ltr">{o.code}</span>
            <span className="flex-1 text-sm">{en ? `${o.percent}% off · ${o.uses === 0 ? "not used yet" : `used ${n(o.uses, "time", "times")}`}` : `خصم ${o.percent}٪ · ${o.uses === 0 ? "لسه متستخدمش" : `اتستخدم ${o.uses} مرات`}`}</span>
            <Switch on={o.active} label={en ? `Code ${o.code} active` : `الكود ${o.code} شغال`} onChange={() => setState((p) => demoToggleOffer(p, o.id))} />
          </div>
        ))}
      </section>
    </div>
  );
}

/* ── Reports ─────────────────────────────────────────────────── */

export function Reports({ state, en }: { state: DemoState; en: boolean }) {
  const r = demoReport(state);
  const tiles = [
    { ar: "الحجوزات", en: "Bookings", v: String(r.total) },
    { ar: "خلصت", en: "Completed", v: String(r.completed) },
    { ar: "محضروش", en: "No-shows", v: String(r.noShows) },
    { ar: "الإيراد", en: "Revenue", v: egp(r.revenue, en) },
  ];
  const max = Math.max(1, ...r.perStaff.map((s) => s.minutes));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.en} className={`${panel} p-4`}>
            <p className="m-0 text-xs text-[var(--color-subtle)]">{en ? t.en : t.ar}</p>
            <p className="num m-0 mt-1 text-[1.375rem] font-bold">{t.v}</p>
          </div>
        ))}
      </div>
      <section className={`${panel} space-y-4 p-5`} aria-label={en ? "Booked time per team member" : "الوقت المحجوز لكل حد"}>
        <p className="m-0 text-sm font-bold">{en ? "Booked time today" : "الوقت المحجوز النهارده"}</p>
        {r.perStaff.map((s) => (
          <div key={s.id} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>{en ? s.en : s.ar}</span>
              <span className="num text-[var(--color-muted)]">{s.minutes} {en ? "min" : "دقيقة"}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-surface-3)]">
              <div className="h-full rounded-full bg-[var(--color-jade)]" style={{ width: `${(s.minutes / max) * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {en ? "Revenue counts completed visits only, the same rule as the real reports." : "الإيراد بيتحسب من الزيارات اللي خلصت بس، زي التقارير الحقيقية."}
        </p>
      </section>
    </div>
  );
}

/* ── Team ────────────────────────────────────────────────────── */

const DAY = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], ar: ["حد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"] };

export function Team({ state, en }: { state: DemoState; en: boolean }) {
  const r = demoReport(state);
  return (
    <section className="grid gap-4 sm:grid-cols-2" aria-label={en ? "Team" : "الفريق"}>
      {state.staff.map((st) => {
        const stats = r.perStaff.find((x) => x.id === st.id);
        return (
          <article key={st.id} className={`${panel} space-y-3 p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-jade-soft)] font-bold text-[var(--color-jade)]">
                {(en ? st.en : st.ar).slice(0, 1)}
              </span>
              <div>
                <p className="m-0 font-bold">{en ? st.en : st.ar}</p>
                <p className="m-0 text-xs text-[var(--color-subtle)]">
                  {en ? `${n(stats?.bookings ?? 0, "booking", "bookings")} · ${stats?.minutes} min today` : `${stats?.bookings} حجز · ${stats?.minutes} دقيقة النهارده`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAY.en.map((d, i) => (
                <span
                  key={d}
                  className={`rounded-full px-2.5 py-1 text-xs ${st.workingDays.includes(i) ? "bg-[var(--color-jade-soft)] font-semibold text-[var(--color-jade-hover)]" : "bg-[var(--color-surface-3)] text-[var(--color-subtle)] line-through"}`}
                >
                  {en ? d : DAY.ar[i]}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
