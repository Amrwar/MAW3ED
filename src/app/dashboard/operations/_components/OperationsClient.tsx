"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Toggle from "@/components/ui/Toggle";
import Tabs from "@/components/ui/Tabs";
import { Field, INPUT, PageHeader, Stat, api, cairoToday, useLoad, useSay } from "@/components/dashboard/kit";
import { formatCents } from "@/lib/payments/money";
import { num } from "@/lib/fmt";
import type { OperationsCounts, OperationsReport } from "@/lib/reports/operations";

interface Settings {
  noShowLimit: number | null;
  noShowWindowDays: number;
  noShowAction: "REQUIRE_DEPOSIT" | "BLOCK_ONLINE";
  waitlistEnabled: boolean;
  waitlistOfferMinutes: number;
  maxCompanions: number;
  followUpEnabled: boolean;
  followUpDelayHours: number;
  rebookReminderEnabled: boolean;
  rebookAfterDays: number;
  membershipRenewalNoticeDays: number;
  loyaltyNoticesEnabled: boolean;
}

export default function OperationsClient() {
  const { say } = useSay();
  const { data, error, loading } = useLoad<{ settings: Settings }>("/api/business/operations");

  return (
    <div className="space-y-6">
      <PageHeader
        title={say("التشغيل اليومي", "Operations")}
        sub={say(
          "قواعد الشغل اليومي — الغياب، قائمة الانتظار، المرافقين والرسايل الأوتوماتيك — وتقرير اليوم أو الفترة.",
          "Your day-to-day rules — no-shows, the waitlist, companions and automatic messages — and the report for a day or a period.",
        )}
      />
      {loading && <Loading />}
      {error && <Alert tone="danger">{error === "network" ? say("تعذّر الاتصال", "Could not connect") : error}</Alert>}
      {data?.settings && <SettingsForm initial={data.settings} />}
      <Report />
    </div>
  );
}

function Loading() {
  const { say } = useSay();
  return (
    <p className="text-sm text-[var(--color-subtle)]">
      <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
      {say("بيحمّل…", "Loading…")}
    </p>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

type NumKey = "noShowWindowDays" | "waitlistOfferMinutes" | "maxCompanions" | "followUpDelayHours" | "rebookAfterDays" | "membershipRenewalNoticeDays";

function SettingsForm({ initial }: { initial: Settings }) {
  const { say } = useSay();
  const [s, setS] = useState(initial);
  const [nums, setNums] = useState<Record<NumKey | "noShowLimit", string>>({
    noShowLimit: initial.noShowLimit == null ? "" : String(initial.noShowLimit),
    noShowWindowDays: String(initial.noShowWindowDays),
    waitlistOfferMinutes: String(initial.waitlistOfferMinutes),
    maxCompanions: String(initial.maxCompanions),
    followUpDelayHours: String(initial.followUpDelayHours),
    rebookAfterDays: String(initial.rebookAfterDays),
    membershipRenewalNoticeDays: String(initial.membershipRenewalNoticeDays),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setN = (k: keyof typeof nums, v: string) => {
    setSaved(false);
    setNums((n) => ({ ...n, [k]: v }));
  };
  const setB = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setS((x) => ({ ...x, [k]: v }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...s,
      noShowLimit: nums.noShowLimit.trim() ? Number(nums.noShowLimit) : null,
      noShowWindowDays: Number(nums.noShowWindowDays),
      waitlistOfferMinutes: Number(nums.waitlistOfferMinutes),
      maxCompanions: Number(nums.maxCompanions),
      followUpDelayHours: Number(nums.followUpDelayHours),
      rebookAfterDays: Number(nums.rebookAfterDays),
      membershipRenewalNoticeDays: Number(nums.membershipRenewalNoticeDays),
    };
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await api<{ settings: Settings }>("/api/business/operations", "PATCH", body);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر الحفظ", "Could not save"));
      return;
    }
    setSaved(true);
  }

  const numInput = (k: keyof typeof nums, min: number, max: number, required = true) => (
    <input id={`op-${k}`} type="number" dir="ltr" min={min} max={max} required={required} value={nums[k]}
      onChange={(e) => setN(k, e.target.value)} className={INPUT} />
  );

  return (
    <form onSubmit={submit} className="space-y-4" aria-labelledby="op-settings-h">
      <h2 id="op-settings-h" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("القواعد", "Rules")}</h2>

      <fieldset className="card m-0 space-y-3 p-5">
        <legend className="px-1 text-[0.875rem] font-bold text-[var(--color-ink)]">{say("الغياب", "No-shows")}</legend>
        <p className="m-0 text-[0.78125rem] text-[var(--color-subtle)]">
          {say(
            "العميل اللي غاب العدد ده من المرات في الفترة دي، حجزه أونلاين بيتعامل بالطريقة اللي تختارها. سيب العدد فاضي عشان تقفل القاعدة.",
            "A customer who missed this many bookings within the window is handled the way you choose when booking online. Leave the count empty to turn the rule off.",
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={say("عدد مرات الغياب", "No-show count")} htmlFor="op-noShowLimit" hint={say("1–20، أو فاضي", "1–20, or empty")}>
            {numInput("noShowLimit", 1, 20, false)}
          </Field>
          <Field label={say("خلال (يوم)", "Within (days)")} htmlFor="op-noShowWindowDays" hint="30–730">
            {numInput("noShowWindowDays", 30, 730)}
          </Field>
          <Field label={say("الإجراء", "Action")} htmlFor="op-noShowAction">
            <select id="op-noShowAction" value={s.noShowAction} onChange={(e) => setB("noShowAction", e.target.value as Settings["noShowAction"])} className={INPUT}>
              <option value="REQUIRE_DEPOSIT">{say("يدفع عربون", "Require a deposit")}</option>
              <option value="BLOCK_ONLINE">{say("مايحجزش أونلاين — يتصل", "Block online booking — they call")}</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="card m-0 space-y-3 p-5">
        <legend className="px-1 text-[0.875rem] font-bold text-[var(--color-ink)]">{say("قائمة الانتظار والمرافقين", "Waitlist and companions")}</legend>
        <Toggle
          label={say("قائمة انتظار للمواعيد المليانة", "Waitlist for full times")}
          hint={say("لما ميعاد يفضى بيتعرض على اللي مستنيين، الأقدم الأول", "A freed time is offered to those waiting, oldest first")}
          checked={s.waitlistEnabled}
          onChange={(v) => setB("waitlistEnabled", v)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={say("مدة حجز العرض (دقيقة)", "Offer held for (minutes)")} htmlFor="op-waitlistOfferMinutes" hint="10–240">
            {numInput("waitlistOfferMinutes", 10, 240)}
          </Field>
          <Field label={say("أقصى عدد مرافقين للحجز", "Max companions per booking")} htmlFor="op-maxCompanions" hint="0–5">
            {numInput("maxCompanions", 0, 5)}
          </Field>
        </div>
      </fieldset>

      <fieldset className="card m-0 space-y-3 p-5">
        <legend className="px-1 text-[0.875rem] font-bold text-[var(--color-ink)]">{say("رسايل أوتوماتيك", "Automatic messages")}</legend>
        <Alert tone="info">
          {say(
            "رسالة المتابعة وتذكير الحجز تاني بيوصلوا بس للعملاء اللي وافقوا يستقبلوا عروض.",
            "Follow-ups and rebooking reminders only reach customers who opted in to offers.",
          )}
        </Alert>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <Toggle label={say("رسالة متابعة بعد الزيارة", "Follow-up after a visit")} checked={s.followUpEnabled} onChange={(v) => setB("followUpEnabled", v)} />
          <Field label={say("بعد (ساعة)", "After (hours)")} htmlFor="op-followUpDelayHours" hint="1–168">
            {numInput("followUpDelayHours", 1, 168)}
          </Field>
          <Toggle label={say("تذكير يحجز تاني", "Rebooking reminder")} checked={s.rebookReminderEnabled} onChange={(v) => setB("rebookReminderEnabled", v)} />
          <Field label={say("بعد آخر زيارة بـ (يوم)", "Days after the last visit")} htmlFor="op-rebookAfterDays" hint="7–365">
            {numInput("rebookAfterDays", 7, 365)}
          </Field>
          <Toggle label={say("رسايل النقاط (كسب وقرب انتهاء)", "Points messages (earned, expiring)")} checked={s.loyaltyNoticesEnabled} onChange={(v) => setB("loyaltyNoticesEnabled", v)} />
          <Field label={say("تنبيه تجديد العضوية قبلها بـ (يوم)", "Membership renewal notice (days before)")} htmlFor="op-membershipRenewalNoticeDays" hint="1–14">
            {numInput("membershipRenewalNoticeDays", 1, 14)}
          </Field>
        </div>
      </fieldset>

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{say("اتحفظ.", "Saved.")}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
        {say("احفظ", "Save")}
      </button>
    </form>
  );
}

// ─── Report ──────────────────────────────────────────────────────────────────

function Report() {
  const { lang, say } = useSay();
  const [from, setFrom] = useState(cairoToday);
  const [days, setDays] = useState<"1" | "7" | "30">("1");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from);
  const { data: r, error, loading } = useLoad<OperationsReport | OperationsCounts>(valid ? `/api/business/reports/operations?from=${from}&days=${days}` : null);
  const money = (c: number) => formatCents(c, "EGP", lang);
  // Without finance.read the report carries counts only (final audit F-20):
  // the money tiles and columns are left out, not shown as NaN.
  const full = r && !("money" in r) ? (r as OperationsReport) : null;
  const n = (v: number) => num(v, lang);

  return (
    <section aria-labelledby="op-report-h" className="space-y-4">
      <h2 id="op-report-h" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("التقرير", "Report")}</h2>
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label={say("من يوم", "From")} htmlFor="op-from">
          <input id="op-from" type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        </Field>
        <Tabs
          label={say("المدة", "Period")}
          value={days}
          onChange={setDays}
          items={[
            { value: "1", label: say("يوم", "1 day") },
            { value: "7", label: say("7 أيام", "7 days") },
            { value: "30", label: say("30 يوم", "30 days") },
          ]}
        />
      </div>

      {loading && <Loading />}
      {error && <Alert tone="danger">{error === "network" ? say("تعذّر الاتصال", "Could not connect") : error}</Alert>}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={say("حجوزات", "Booked")} value={n(r.totals.booked)} />
            <Stat label={say("اكتملت", "Completed")} value={n(r.totals.completed)} />
            <Stat label={say("اتلغت", "Cancelled")} value={n(r.totals.cancelled)} />
            <Stat label={say("غياب", "No-shows")} value={n(r.totals.noShows)} hint={say(`${r.totals.noShowRate}% من اللي خلصت`, `${r.totals.noShowRate}% of ended`)} />
            <Stat label={say("من غير حجز (walk-in)", "Walk-ins")} value={n(r.totals.walkIns)} />
            {full && <Stat label={say("الإيراد", "Revenue")} value={money(full.totals.revenueCents)} />}
          </div>

          {r.staff.length > 0 && (
            <Table
              title={full ? say("الفريق والعمولة", "Staff and commission") : say("الفريق", "Staff")}
              head={[
                say("الاسم", "Name"), say("حجوزات", "Booked"), say("اكتملت", "Completed"), say("غياب", "No-shows"),
                ...(full ? [say("الإيراد", "Revenue"), say("العمولة", "Commission")] : []),
              ]}
              rows={
                full
                  ? full.staff.map((s) => [
                      s.name, n(s.booked), n(s.completed), n(s.noShows), money(s.revenueCents),
                      s.commissionPercent == null ? "—" : `${money(s.commissionCents)} (${s.commissionPercent}%)`,
                    ])
                  : r.staff.map((s) => [s.name, n(s.booked), n(s.completed), n(s.noShows)])
              }
            />
          )}

          {r.resources.length > 0 && (
            <Table
              title={say("الأماكن (طاولات / غرف / كراسي)", "Places (tables / rooms / chairs)")}
              head={[say("المكان", "Place"), say("المنطقة", "Area"), say("حجوزات", "Booked"), say("اكتملت", "Completed"), say("ضيوف", "Guests"), say("دقايق", "Minutes"), say("دورات/يوم", "Turns/day")]}
              rows={r.resources.map((x) => [x.name, x.area ?? "—", n(x.booked), n(x.completed), n(x.guests), n(x.minutes), String(x.turnsPerDay)])}
            />
          )}

          {r.areas.length > 0 && (
            <Table
              title={say("المناطق", "Areas")}
              head={[say("المنطقة", "Area"), say("حجوزات", "Booked"), say("اكتملت", "Completed"), say("ضيوف", "Guests")]}
              rows={r.areas.map((a) => [a.area, n(a.booked), n(a.completed), n(a.guests)])}
            />
          )}

          {r.groups.length > 0 && (
            <Table
              title={say("فئات الخدمات", "Service categories")}
              head={[say("الفئة", "Category"), say("حجوزات", "Booked"), say("اكتملت", "Completed"), say("غياب", "No-shows")]}
              rows={r.groups.map((g) => [g.group, n(g.booked), n(g.completed), n(g.noShows)])}
            />
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="m-0 mb-2 text-[0.875rem] font-bold">{say("قائمة الانتظار", "Waitlist")}</h3>
              <dl className="num m-0 grid grid-cols-2 gap-1 text-[0.8125rem]">
                <dt className="text-[var(--color-subtle)]">{say("انضموا", "Joined")}</dt><dd className="m-0">{n(r.waitlist.joined)}</dd>
                <dt className="text-[var(--color-subtle)]">{say("اتعرض عليهم", "Offered")}</dt><dd className="m-0">{n(r.waitlist.offered)}</dd>
                <dt className="text-[var(--color-subtle)]">{say("حجزوا", "Booked")}</dt><dd className="m-0">{n(r.waitlist.booked)}</dd>
                <dt className="text-[var(--color-subtle)]">{say("العرض انتهى", "Expired")}</dt><dd className="m-0">{n(r.waitlist.expired)}</dd>
              </dl>
            </div>
            <div className="card p-4">
              <h3 className="m-0 mb-2 text-[0.875rem] font-bold">{say("الباقات والعضويات", "Packages & memberships")}</h3>
              <dl className="num m-0 grid grid-cols-2 gap-1 text-[0.8125rem]">
                <dt className="text-[var(--color-subtle)]">{say("باقات اتباعت", "Packages sold")}</dt><dd className="m-0">{n(r.packages.sold)}{full ? ` · ${money(full.packages.soldCents)}` : ""}</dd>
                <dt className="text-[var(--color-subtle)]">{say("جلسات اتستخدمت", "Sessions used")}</dt><dd className="m-0">{n(r.packages.sessionsUsed)}</dd>
                <dt className="text-[var(--color-subtle)]">{say("عضويات شغّالة", "Active memberships")}</dt><dd className="m-0">{n(r.packages.membershipsActive)}</dd>
                <dt className="text-[var(--color-subtle)]">{say("زيارات بالعضوية", "Membership visits")}</dt><dd className="m-0">{n(r.packages.membershipVisits)}</dd>
              </dl>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[36rem] text-[0.8125rem]">
        <caption className="p-3 text-start text-[0.875rem] font-bold text-[var(--color-ink)]">{title}</caption>
        <thead>
          <tr className="text-[0.75rem] text-[var(--color-subtle)]">
            {head.map((h) => <th key={h} scope="col" className="p-3 text-start font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--color-line)]">
              {row.map((c, j) => <td key={j} className={j === 0 ? "p-3" : "num p-3"}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
