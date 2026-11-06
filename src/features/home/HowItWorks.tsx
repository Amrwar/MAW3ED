"use client";

import { useState, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Tabs from "@/components/ui/Tabs";
import {
  Bell, CalendarDays, CheckCircle2, Copy, QrCode, Search,
  Share2, Store, TrendingUp, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOMER_ICONS = [Search, CalendarDays, CheckCircle2];
const BUSINESS_ICONS = [Store, Share2, TrendingUp];

/**
 * Three numbered steps on a timeline, each with a small picture of the
 * screen it happens on. The pictures are samples drawn in markup, not
 * records, and are hidden from screen readers: the step text says it.
 *
 * A white band with hairlines, between the white "near you" panel's
 * ground and the stone "why Maw3ed" band.
 */
export default function HowItWorks() {
  const { t, lang } = useLanguage();
  const h = t.howItWorks;
  const [tab, setTab] = useState<"customer" | "business">("customer");
  const en = lang === "en";

  const steps = tab === "customer" ? h.customerSteps : h.businessSteps;
  const icons = tab === "customer" ? CUSTOMER_ICONS : BUSINESS_ICONS;
  const pictures = tab === "customer" ? customerPictures(en) : businessPictures(en);

  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)] py-20">
      <div className="container-app">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-[40rem]">
            <span className="section-eyebrow">{h.eyebrow}</span>
            <h2 className="section-title mt-2.5">{h.title}</h2>
            <p className="section-subtitle mt-4">{h.subtitle}</p>
          </div>
          <Tabs
            label={h.eyebrow}
            value={tab}
            onChange={setTab}
            items={[
              { value: "customer", label: h.forCustomers },
              { value: "business", label: h.forBusinesses },
            ]}
            className="shrink-0"
          />
        </div>

        <ol className="grid list-none gap-12 p-0 lg:grid-cols-3 lg:gap-10">
          {steps.map((step, i) => {
            const Icon = icons[i];
            const last = i === steps.length - 1;
            return (
              <li key={step.title} className="flex min-w-0 flex-col">
                <div className="mb-6 flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-jade)] bg-[var(--color-surface)] text-[1.0625rem] font-bold leading-none text-[var(--color-jade)]"
                  >
                    <span className="num">{i + 1}</span>
                  </span>
                  {!last && (
                    <span aria-hidden="true" className="hidden h-0 flex-1 border-t-2 border-dashed border-[var(--color-jade-line)] lg:block" />
                  )}
                </div>
                <h3 className="m-0 flex items-center gap-2.5 text-[1.25rem] font-bold text-[var(--color-ink)]">
                  <Icon size={19} strokeWidth={1.8} className="shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
                  {step.title}
                </h3>
                <p className="m-0 mt-3 text-[0.90625rem] leading-[1.8] text-[var(--color-muted)]">{step.description}</p>
                <div aria-hidden="true" className="mt-6">
                  {pictures[i]}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-raised)]", className)}>
      {children}
    </div>
  );
}

function Chip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[0.78125rem] font-bold",
        dark ? "bg-[var(--color-ink)] text-[var(--color-inverse)]" : "bg-[var(--color-surface-3)] text-[var(--color-ink-2)]",
      )}
    >
      {children}
    </span>
  );
}

function Row({ icon, title, sub, soft }: { icon: ReactNode; title: string; sub?: string; soft?: boolean }) {
  return (
    <Panel className={cn("flex items-center gap-3", soft && "py-3 shadow-none")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-jade)]",
          soft ? "h-7 w-7" : "h-10 w-10 bg-[var(--color-jade-soft)]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-bold text-[var(--color-ink)]">{title}</span>
        {sub && <span className="block truncate text-[0.8125rem] text-[var(--color-subtle)]">{sub}</span>}
      </span>
    </Panel>
  );
}

function Slots({ times, picked }: { times: string[]; picked: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {times.map((x) => (
        <span
          key={x}
          className={cn(
            "num rounded-[var(--radius-md)] border py-2 text-center text-[0.875rem] font-bold",
            x === picked
              ? "border-[var(--color-jade)] bg-[var(--color-jade)] text-[var(--color-inverse)]"
              : "border-[var(--color-line)] text-[var(--color-ink)]",
          )}
        >
          {x}
        </span>
      ))}
    </div>
  );
}

function customerPictures(en: boolean): ReactNode[] {
  return [
    <Panel key="search">
      <div className="flex items-center gap-2.5 rounded-full border border-[var(--color-line-2)] px-4 py-2.5 text-[0.875rem] text-[var(--color-subtle)]">
        <Search size={15} className="shrink-0" />
        {en ? "Dentist in Nasr City" : "دكتور أسنان في مدينة نصر"}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip dark>{en ? "Clinics" : "عيادات"}</Chip>
        <Chip>{en ? "Cairo" : "القاهرة"}</Chip>
        <Chip>{en ? "4.5+ rating" : "تقييم ٤٫٥+"}</Chip>
      </div>
    </Panel>,
    <Panel key="slots">
      <div className="mb-3 flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="font-bold text-[var(--color-ink)]">{en ? "Tomorrow" : "بكرة"}</span>
        <span className="truncate text-[var(--color-subtle)]">{en ? "Consultation · 400 EGP" : "كشف · ٤٠٠ ج.م"}</span>
      </div>
      <Slots times={["10:00", "10:30", "11:00", "12:30", "4:00", "4:30"]} picked="11:00" />
    </Panel>,
    <div key="done" className="flex flex-col gap-2.5">
      <Row
        icon={<CheckCircle2 size={19} strokeWidth={1.9} />}
        title={en ? "Booking confirmed" : "تم تأكيد الحجز"}
        sub={en ? "Tomorrow 11:00 AM · Nasr City" : "بكرة ١١:٠٠ ص · مدينة نصر"}
      />
      <Row soft icon={<Bell size={16} strokeWidth={1.9} className="text-[var(--color-warn)]" />} title={en ? "Reminder before your appointment" : "تذكير قبل ميعادك"} />
    </div>,
  ];
}

function businessPictures(en: boolean): ReactNode[] {
  return [
    <Panel key="page">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]">
          <Store size={18} strokeWidth={1.8} />
        </span>
        <span className="text-[0.9375rem] font-bold text-[var(--color-ink)]">{en ? "Your business" : "نشاطك"}</span>
      </div>
      {[
        [en ? "Haircut · 30 min" : "قص شعر · ٣٠ دقيقة", en ? "150 EGP" : "١٥٠ ج.م"],
        [en ? "Beard trim · 20 min" : "تهذيب دقن · ٢٠ دقيقة", en ? "80 EGP" : "٨٠ ج.م"],
      ].map(([s, p]) => (
        <div key={s} className="flex justify-between gap-3 border-t border-[var(--color-line)] py-2 text-[0.8125rem]">
          <span className="text-[var(--color-ink-2)]">{s}</span>
          <span className="num font-bold text-[var(--color-ink)]">{p}</span>
        </div>
      ))}
    </Panel>,
    <Panel key="share">
      <div className="flex items-center gap-2 rounded-full border border-[var(--color-line-2)] py-1.5 pe-1.5 ps-4">
        <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[0.8125rem] text-[var(--color-ink-2)]">maw3ed.net/your-business</span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[0.75rem] font-bold text-[var(--color-inverse)]">
          <Copy size={12} /> {en ? "Copy" : "انسخ"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-3)] px-3 py-1 text-[0.78125rem] font-bold text-[var(--color-ink-2)]">
          <MessageCircle size={13} /> {en ? "Share on WhatsApp" : "شارك على واتساب"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-3)] px-3 py-1 text-[0.78125rem] font-bold text-[var(--color-ink-2)]">
          <QrCode size={13} /> {en ? "QR code" : "كود QR"}
        </span>
      </div>
    </Panel>,
    <div key="grow" className="flex flex-col gap-2.5">
      <Row
        icon={<CalendarDays size={18} strokeWidth={1.9} />}
        title={en ? "New booking" : "حجز جديد"}
        sub={en ? "Tomorrow 11:00 AM · Haircut" : "بكرة ١١:٠٠ ص · قص شعر"}
      />
      <Row soft icon={<Bell size={16} strokeWidth={1.9} className="text-[var(--color-warn)]" />} title={en ? "Reminder sent to your customer" : "اتبعت تذكير لعميلك"} />
    </div>,
  ];
}
