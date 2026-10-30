"use client";

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw, CalendarDays, PlusCircle, Users, BarChart3, Users2 } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DEMO_BUSINESS,
  clockOf,
  demoBook,
  demoReport,
  demoSetStatus,
  demoSlots,
  initialDemoState,
  type DemoState,
  type DemoStatus,
} from "@/lib/demo/workspace";

type Tab = "calendar" | "book" | "customers" | "reports" | "staff";

const STATUS_LABEL: Record<DemoStatus, { ar: string; en: string; cls: string }> = {
  PENDING: { ar: "مستني تأكيد", en: "Pending", cls: "badge-warning" },
  CONFIRMED: { ar: "متأكد", en: "Confirmed", cls: "badge-accent" },
  COMPLETED: { ar: "خلص", en: "Completed", cls: "badge-success" },
  NO_SHOW: { ar: "محضرش", en: "No-show", cls: "badge-danger" },
  CANCELLED: { ar: "اتلغى", en: "Cancelled", cls: "" },
};

export default function DemoClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const [state, setState] = useState<DemoState>(initialDemoState);
  const [tab, setTab] = useState<Tab>("calendar");

  const tabs: { id: Tab; ar: string; en: string; Icon: typeof CalendarDays }[] = [
    { id: "calendar", ar: "النهارده", en: "Today", Icon: CalendarDays },
    { id: "book", ar: "حجز جديد", en: "New booking", Icon: PlusCircle },
    { id: "customers", ar: "العملاء", en: "Customers", Icon: Users },
    { id: "reports", ar: "التقارير", en: "Reports", Icon: BarChart3 },
    { id: "staff", ar: "الفريق", en: "Team", Icon: Users2 },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]">
      <div
        role="status"
        className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[var(--color-star)] px-4 py-3 text-center text-[0.84375rem] font-bold text-[var(--color-night)]"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical size={16} aria-hidden="true" />
          {en
            ? "Demo workspace — fictional data. Nothing here is saved or sent to anyone."
            : "نسخة تجريبية — بيانات وهمية. مفيش حاجة هنا بتتحفظ أو بتتبعت لحد."}
        </span>
        <button type="button" className="inline-flex items-center gap-1 underline underline-offset-2" onClick={() => setState(initialDemoState())}>
          <RotateCcw size={14} aria-hidden="true" />
          {en ? "Reset" : "ابدأ من الأول"}
        </button>
        <Link href="/signup" className="underline underline-offset-2">
          {en ? "Create your real page" : "اعمل صفحتك الحقيقية"}
        </Link>
      </div>

      <main id="main" className="mx-auto max-w-[1000px] space-y-5 p-4 md:p-7">
        <h1 className="m-0 text-[1.625rem] font-light tracking-tight text-[var(--color-ink)]">
          {en ? DEMO_BUSINESS.en : DEMO_BUSINESS.ar}
        </h1>

        <nav aria-label={en ? "Demo sections" : "أقسام التجربة"} className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`btn btn-sm gap-1.5 ${tab === t.id ? "btn-primary" : "btn-outline"}`}
            >
              <t.Icon size={15} aria-hidden="true" />
              {en ? t.en : t.ar}
            </button>
          ))}
        </nav>

        {tab === "calendar" && <Calendar state={state} en={en} onStatus={(id, s) => setState((prev) => demoSetStatus(prev, id, s))} />}
        {tab === "book" && (
          <BookForm
            state={state}
            en={en}
            onBook={(input) => {
              setState((prev) => demoBook(prev, input));
              setTab("calendar");
            }}
          />
        )}
        {tab === "customers" && <Customers state={state} en={en} />}
        {tab === "reports" && <Reports state={state} en={en} />}
        {tab === "staff" && <Staff state={state} en={en} />}
      </main>
    </div>
  );
}

function Calendar({ state, en, onStatus }: { state: DemoState; en: boolean; onStatus: (id: string, s: DemoStatus) => void }) {
  const rows = [...state.bookings].sort((a, b) => a.start - b.start);
  return (
    <section className="card divide-y divide-[var(--color-line)]" aria-label={en ? "Today's appointments" : "مواعيد النهارده"}>
      {rows.map((b) => {
        const svc = state.services.find((s) => s.id === b.serviceId);
        const st = state.staff.find((s) => s.id === b.staffId);
        const c = state.customers.find((x) => x.id === b.customerId);
        const label = STATUS_LABEL[b.status];
        return (
          <div key={b.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="num w-14 font-bold" dir="ltr">{clockOf(b.start)}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-bold">{c?.name}</p>
              <p className="m-0 text-xs text-[var(--color-subtle)]">
                {en ? svc?.en : svc?.ar} · {en ? st?.en : st?.ar}
              </p>
            </div>
            <span className={`badge ${label.cls}`}>{en ? label.en : label.ar}</span>
            {b.status === "PENDING" && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onStatus(b.id, "CONFIRMED")}>
                {en ? "Confirm" : "أكّد"}
              </button>
            )}
            {b.status === "CONFIRMED" && (
              <>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => onStatus(b.id, "COMPLETED")}>
                  {en ? "Mark done" : "خلص"}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onStatus(b.id, "NO_SHOW")}>
                  {en ? "No-show" : "محضرش"}
                </button>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

function BookForm({
  state,
  en,
  onBook,
}: {
  state: DemoState;
  en: boolean;
  onBook: (input: { serviceId: string; staffId: string; time: string; customerName: string }) => void;
}) {
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // Today, as the visitor's clock has it. Slots before now are not offered.
  const [{ dow, nowMin }] = useState(() => {
    const d = new Date();
    return { dow: d.getDay(), nowMin: d.getHours() * 60 + d.getMinutes() };
  });
  const { slots, assignments } = useMemo(
    () => demoSlots(state, serviceId, staffId, dow, nowMin),
    [state, serviceId, staffId, dow, nowMin],
  );
  const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

  return (
    <section className="card space-y-4 p-5" aria-label={en ? "New booking" : "حجز جديد"}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Service" : "الخدمة"}</span>
          <select className={field} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {state.services.map((s) => (
              <option key={s.id} value={s.id}>
                {en ? s.en : s.ar} · {s.duration} {en ? "min" : "دقيقة"} · {s.price} {en ? "EGP" : "ج.م"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "With" : "مع"}</span>
          <select className={field} value={staffId ?? ""} onChange={(e) => setStaffId(e.target.value || null)}>
            <option value="">{en ? "Anyone available" : "أي حد متاح"}</option>
            {state.staff.map((s) => (
              <option key={s.id} value={s.id}>{en ? s.en : s.ar}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">{en ? "Customer name" : "اسم العميل"}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={en ? "Any name — it's a demo" : "أي اسم — دي تجربة"} />
        </label>
      </div>
      <div>
        <p className="m-0 mb-2 text-sm font-bold">{en ? "Free times today" : "المواعيد الفاضية النهارده"}</p>
        {slots.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">
            {en ? "No free times left today for this choice." : "مفيش مواعيد فاضية النهارده للاختيار ده."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                dir="ltr"
                className="btn btn-sm btn-outline num"
                onClick={() => onBook({ serviceId, staffId: staffId ?? assignments[t] ?? state.staff[0].id, time: t, customerName: name })}
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

function Customers({ state, en }: { state: DemoState; en: boolean }) {
  return (
    <section className="card divide-y divide-[var(--color-line)]" aria-label={en ? "Customers" : "العملاء"}>
      {state.customers.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="m-0 font-bold">{c.name}</p>
            <p className="m-0 text-xs text-[var(--color-subtle)]" dir="ltr">{c.phone}</p>
          </div>
          <span className="text-xs text-[var(--color-muted)]">
            {en ? `${c.visits} past visits` : `زيارات سابقة: ${c.visits}`}
          </span>
        </div>
      ))}
    </section>
  );
}

function Reports({ state, en }: { state: DemoState; en: boolean }) {
  const r = demoReport(state);
  const tiles = [
    { ar: "الحجوزات", en: "Bookings", v: r.total },
    { ar: "خلصت", en: "Completed", v: r.completed },
    { ar: "محضروش", en: "No-shows", v: r.noShows },
    { ar: "الإيراد (ج.م)", en: "Revenue (EGP)", v: r.revenue },
  ];
  return (
    <section className="space-y-3" aria-label={en ? "Reports" : "التقارير"}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.en} className="card p-4">
            <p className="m-0 text-xs text-[var(--color-subtle)]">{en ? t.en : t.ar}</p>
            <p className="num m-0 text-2xl font-bold">{t.v}</p>
          </div>
        ))}
      </div>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {en ? "Revenue counts completed visits only — the same rule as the real reports." : "الإيراد بيتحسب من الزيارات اللي خلصت بس — زي التقارير الحقيقية."}
      </p>
    </section>
  );
}

function Staff({ state, en }: { state: DemoState; en: boolean }) {
  const r = demoReport(state);
  return (
    <section className="card divide-y divide-[var(--color-line)]" aria-label={en ? "Team" : "الفريق"}>
      {r.perStaff.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 p-4">
          <p className="m-0 font-bold">{en ? s.en : s.ar}</p>
          <span className="text-sm text-[var(--color-muted)]">
            {en ? `${s.bookings} bookings · ${s.minutes} min booked` : `${s.bookings} حجز · ${s.minutes} دقيقة محجوزة`}
          </span>
        </div>
      ))}
    </section>
  );
}
