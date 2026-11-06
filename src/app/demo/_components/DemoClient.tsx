"use client";

import { useState } from "react";
import {
  FlaskConical, RotateCcw, LayoutDashboard, CalendarDays, PlusCircle, Users, Globe, BellRing,
  MessageSquare, Ticket, BarChart3, Users2, ArrowLeft, ArrowRight,
} from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import Logo from "@/components/shared/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEMO_BUSINESS, demoOverview, initialDemoState, type DemoState } from "@/lib/demo/workspace";
import {
  Overview, CalendarView, BookForm, Customers, BookingPage, Reminders, Reviews, Offers, Reports, Team,
} from "./DemoSections";

export type Tab =
  | "overview" | "calendar" | "book" | "customers"
  | "page" | "reminders" | "reviews" | "offers"
  | "reports" | "team";

type Item = { id: Tab; ar: string; en: string; Icon: typeof CalendarDays; badge?: number };

/**
 * The demo, laid out like the real dashboard: a sidebar of the same
 * sections, grouped the way an owner thinks about them (run the day,
 * grow, see how it went), so a visitor is trying the product they will
 * get rather than a toy.
 *
 * Every section is a feature the real dashboard has (bookings and
 * calendar, customers, the public page and its link and QR, reminders,
 * replying to reviews, discount codes, reports, the team). All of it runs
 * on invented data in this tab: lib/demo/workspace.ts holds the state
 * and its rules, and demo.test checks nothing here can reach a server.
 */
export default function DemoClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const Arrow = en ? ArrowRight : ArrowLeft;
  const [state, setState] = useState<DemoState>(initialDemoState);
  const [tab, setTab] = useState<Tab>("overview");
  const o = demoOverview(state);

  const groups: { ar: string; en: string; items: Item[] }[] = [
    {
      ar: "اليوم", en: "Run the day",
      items: [
        { id: "overview", ar: "الرئيسية", en: "Overview", Icon: LayoutDashboard, badge: o.pending || undefined },
        { id: "calendar", ar: "التقويم", en: "Calendar", Icon: CalendarDays },
        { id: "book", ar: "حجز جديد", en: "New booking", Icon: PlusCircle },
        { id: "customers", ar: "العملاء", en: "Customers", Icon: Users },
      ],
    },
    {
      ar: "النمو", en: "Grow",
      items: [
        { id: "page", ar: "صفحة الحجز", en: "Booking page", Icon: Globe },
        { id: "reminders", ar: "التذكيرات", en: "Reminders", Icon: BellRing },
        { id: "reviews", ar: "التقييمات", en: "Reviews", Icon: MessageSquare, badge: o.unanswered || undefined },
        { id: "offers", ar: "العروض", en: "Offers", Icon: Ticket },
      ],
    },
    {
      ar: "النتائج", en: "Insights",
      items: [
        { id: "reports", ar: "التقارير", en: "Reports", Icon: BarChart3 },
        { id: "team", ar: "الفريق", en: "Team", Icon: Users2 },
      ],
    },
  ];
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => i.id === tab)!;

  const go = (t: Tab) => {
    setTab(t);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]">
      {/* Says what this is on every screen, and offers the way out. */}
      <header className="sticky top-0 z-50 bg-[var(--color-night)] text-[var(--color-inverse)]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 md:px-6">
          {/* The logo is its own link home (components/shared/Logo). */}
          <span className="shrink-0">
            <Logo size="sm" variant="white" />
          </span>
          <span
            role="status"
            className="hidden items-center gap-2 rounded-full border border-[var(--color-night-line)] bg-[var(--color-night-2)] px-3 py-1.5 text-[0.78125rem] text-[var(--color-night-text)] sm:inline-flex"
          >
            <FlaskConical size={14} aria-hidden="true" className="text-[var(--color-night-accent)]" />
            {en ? "Live demo · sample data, nothing is saved" : "ديمو مباشر · بيانات وهمية، مفيش حاجة بتتحفظ"}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setState(initialDemoState()); go("overview"); }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] text-[var(--color-night-text)] transition-colors hover:text-[var(--color-inverse)]"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{en ? "Reset" : "ابدأ من الأول"}</span>
            </button>
            <Link href="/signup?type=business" className="btn btn-primary btn-sm btn-pill">
              {en ? "Create your real page" : "اعمل صفحتك الحقيقية"}
            </Link>
          </div>
        </div>
        {/* Phones: the notice the pill above carries on wider screens. */}
        <p className="m-0 bg-[var(--color-night-2)] px-4 py-1.5 text-center text-[0.75rem] text-[var(--color-night-text)] sm:hidden">
          {en ? "Live demo · sample data, nothing is saved" : "ديمو مباشر · بيانات وهمية، مفيش حاجة بتتحفظ"}
        </p>
      </header>

      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-5 md:px-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:py-8">
        {/* Sidebar on a laptop; a scrolling row of sections on a phone. */}
        {/* min-w-0: the phone row of sections scrolls inside it instead of
            stretching the grid, and with it the page, past the screen. */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] lg:flex">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-jade-soft)] text-sm font-extrabold text-[var(--color-jade)]">
              {en ? "SS" : "ص"}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold text-[var(--color-ink)]">{en ? DEMO_BUSINESS.en : DEMO_BUSINESS.ar}</span>
              <span className="block text-xs text-[var(--color-subtle)]">{en ? "Free plan · sample" : "الخطة المجانية · تجريبي"}</span>
            </span>
          </div>

          <nav aria-label={en ? "Demo sections" : "أقسام الديمو"} className="lg:mt-4">
            <ul className="-mx-4 flex list-none gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:hidden">
              {all.map((i) => (
                <li key={i.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={tab === i.id ? "page" : undefined}
                    onClick={() => go(i.id)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors ${
                      tab === i.id
                        ? "border-[var(--color-jade)] bg-[var(--color-jade)] text-[var(--color-inverse)]"
                        : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    <i.Icon size={15} aria-hidden="true" />
                    {en ? i.en : i.ar}
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden space-y-5 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] lg:block">
              {groups.map((g) => (
                <div key={g.en}>
                  <p className="m-0 px-3 pb-1.5 pt-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--color-subtle)]">
                    {en ? g.en : g.ar}
                  </p>
                  <ul className="m-0 list-none space-y-0.5 p-0">
                    {g.items.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          aria-current={tab === i.id ? "page" : undefined}
                          onClick={() => go(i.id)}
                          className={`flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-start text-[0.875rem] transition-colors ${
                            tab === i.id
                              ? "bg-[var(--color-jade-soft)] font-bold text-[var(--color-jade)]"
                              : "text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]"
                          }`}
                        >
                          <i.Icon size={17} aria-hidden="true" />
                          <span className="flex-1">{en ? i.en : i.ar}</span>
                          {i.badge ? (
                            <span className="rounded-full bg-[var(--color-warn-soft)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--color-warn)]">
                              {i.badge}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-4 hidden rounded-[var(--radius-lg)] border border-[var(--color-jade-line)] bg-[var(--color-jade-tint)] p-4 lg:block">
            <p className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
              {en ? "Like what you see?" : "عجبك؟"}
            </p>
            <p className="m-0 mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-muted)]">
              {en ? "Your real page takes about five minutes, and the free plan stays free." : "صفحتك الحقيقية بتاخد حوالي ٥ دقايق، والخطة المجانية مجانية على طول."}
            </p>
            <Link href="/signup?type=business" className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--color-jade)]">
              {en ? "Start free" : "ابدأ مجانًا"}
              <Arrow size={14} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <main id="main" className="min-w-0 space-y-5">
          <div>
            <h1 className="m-0 text-[1.625rem] font-light tracking-tight text-[var(--color-ink)]">
              {en ? current.en : current.ar}
            </h1>
            <p className="m-0 mt-1 text-[0.875rem] text-[var(--color-muted)]">{subtitle(tab, en)}</p>
          </div>

          {tab === "overview" && <Overview state={state} en={en} setState={setState} go={go} />}
          {tab === "calendar" && <CalendarView state={state} en={en} />}
          {tab === "book" && <BookForm state={state} en={en} setState={setState} go={go} />}
          {tab === "customers" && <Customers state={state} en={en} />}
          {tab === "page" && <BookingPage state={state} en={en} />}
          {tab === "reminders" && <Reminders state={state} en={en} setState={setState} />}
          {tab === "reviews" && <Reviews state={state} en={en} setState={setState} />}
          {tab === "offers" && <Offers state={state} en={en} setState={setState} />}
          {tab === "reports" && <Reports state={state} en={en} />}
          {tab === "team" && <Team state={state} en={en} />}
        </main>
      </div>
    </div>
  );
}

const SUBTITLES: Record<Tab, [string, string]> = {
    overview:  ["Today at a glance, and what needs you.", "يومك في نظرة، واللي محتاجك."],
    calendar:  ["Who is booked when, per team member.", "مين محجوز إمتى، لكل حد في الفريق."],
    book:      ["Add a walk-in or a phone booking. Only free times are offered.", "ضيف حجز من المحل أو التليفون. المواعيد الفاضية بس اللي بتظهر."],
    customers: ["Everyone who booked, with their visits.", "كل اللي حجزوا، وعدد زياراتهم."],
    page:      ["What customers see, and the link and QR you share.", "اللي العملاء بيشوفوه، واللينك والـQR اللي بتشاركهم."],
    reminders: ["Automatic messages that cut no-shows.", "رسائل تلقائية بتقلل اللي مبيجوش."],
    reviews:   ["Reviews from real visits. Reply in public.", "تقييمات من زيارات حقيقية. رد عليها قدام الكل."],
    offers:    ["Discount codes customers type when they book.", "أكواد خصم العميل بيكتبها وهو بيحجز."],
    reports:   ["Bookings, no-shows and revenue, counted like the real reports.", "الحجوزات واللي محضروش والإيراد، محسوبين زي التقارير الحقيقية."],
    team:      ["Each team member's day.", "يوم كل حد في الفريق."],
};

function subtitle(tab: Tab, en: boolean): string {
  return en ? SUBTITLES[tab][0] : SUBTITLES[tab][1];
}
