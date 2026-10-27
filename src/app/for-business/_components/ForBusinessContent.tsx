"use client";

import Link from "@/components/shared/LocaleLink";
import { countText } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import {
  CheckCircle, BarChart3, Bell,
  Globe, Zap, Users,
  CalendarDays, ShieldCheck, LayoutDashboard,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cdnImage } from "@/lib/cdn-image";

/** A business that is actually on Maw3ed. Nothing here is written by us. */
export interface RealBusiness {
  slug: string;
  nameAr: string;
  nameEn: string | null;
  categoryAr: string;
  categoryEn: string;
  cityAr: string;
  cityEn: string;
  logoImage: string | null;
}

// ─── Benefit icon config (gradient backgrounds matching brand) ──────────────
const BENEFIT_ICONS = [
  { Icon: Globe,        iconBg: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)" },
  { Icon: CalendarDays, iconBg: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-line) 100%)" },
  { Icon: Bell,         iconBg: "linear-gradient(135deg, var(--color-warn) 0%, var(--color-star) 100%)" },
  { Icon: BarChart3,    iconBg: "linear-gradient(135deg, var(--color-ok) 0%, var(--color-jade) 100%)" },
  { Icon: Users,        iconBg: "linear-gradient(135deg, var(--color-jade-hover) 0%, var(--color-jade-line) 100%)" },
  { Icon: ShieldCheck,  iconBg: "linear-gradient(135deg, var(--color-info) 0%, var(--color-info) 100%)" },
];

export default function ForBusinessContent({
  businesses,
  total,
}: {
  businesses: RealBusiness[];
  /** Published listings, or null while too few to be worth stating. */
  total: number | null;
}) {
  const { t, lang } = useLanguage();
  const fb   = t.forBusiness;
  const isAr = lang === "ar";

  const heroTitle = (
    <>
      {fb.heroTitle}{" "}
      <span
        style={{
          background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-line) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {fb.heroAccent}
      </span>
    </>
  );

  // PageHero sits on the light ground now, so these take the standard
  // button treatment rather than the old white-on-navy styling.
  const heroCta = (
    <>
      <Link href="/signup?type=business" className="btn btn-primary btn-pill btn-lg">
        {fb.cta1}
      </Link>
      <Link href="/pricing" className="btn btn-outline btn-pill btn-lg">
        {fb.cta2}
      </Link>
    </>
  );

  return (
    <>
      <Navbar />
      <main id="main">
        <PageHero
          badge={fb.badge}
          title={heroTitle}
          subtitle={fb.heroSub}
          cta={heroCta}
          dir={isAr ? "rtl" : "ltr"}
        />

        {/* ══════════════════════════════════════════
            Benefits — "Why Maw3ed" premium section
        ══════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden py-24 lg:py-32"
          style={{ background: "var(--color-surface-2)" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Ambient glows */}
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-48 w-[640px] h-[640px] rounded-full opacity-[0.07]"
              style={{
                insetInlineStart: "20%",
                background: "radial-gradient(circle, var(--color-jade) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute -bottom-40 w-[400px] h-[400px] rounded-full opacity-[0.05]"
              style={{
                insetInlineEnd: "-4%",
                background: "radial-gradient(circle, var(--color-jade) 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="container-app relative z-10">

            {/* ── Section heading ── */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--color-jade)]/25 bg-[var(--color-jade)]/[0.07] mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-jade)]" />
                <span
                  className="font-semibold uppercase text-[0.6875rem]"
                  style={{ color: "var(--color-jade-hover)", letterSpacing: "0.07em" }}
                >
                  {fb.benefitsEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-[var(--color-ink)] mb-5"
                style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
              >
                {fb.benefitsTitle}
              </h2>
              <p className="text-[var(--color-muted)] text-lg max-w-xl mx-auto" style={{ lineHeight: 1.75 }}>
                {fb.benefitsSub}
              </p>
            </div>

            {/* ── Main: feature cards (start) + dashboard mockup (end) ── */}
            <div className="grid md:grid-cols-2 lg:grid-cols-[1fr_1.1fr] gap-7 mb-7">

              {/* First 3 feature cards — stacked */}
              <div className="flex flex-col gap-5">
                {fb.benefits.slice(0, 3).map((b, i) => {
                  const { Icon, iconBg } = BENEFIT_ICONS[i];
                  return (
                    <div
                      key={b.title}
                      className="rounded-[var(--radius-xl)] bg-white flex items-start gap-5 p-6 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                      style={{
                        border:     "1px solid var(--color-line)",
                        boxShadow:  "0 1px 4px rgba(17,32,28,0.04), 0 4px 16px rgba(17,32,28,0.03)",
                        transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-[var(--radius-lg)] flex items-center justify-center shrink-0"
                        style={{ background: iconBg }}
                      >
                        <Icon size={22} strokeWidth={1.75} className="text-white" />
                      </div>
                      <div>
                        <h3
                          className="text-[15px] font-extrabold text-[var(--color-ink)] mb-1.5"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {b.title}
                        </h3>
                        <p className="text-sm text-[var(--color-muted)] leading-relaxed">{b.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Dashboard product mockup ── */}
              <div
                className="relative flex items-start justify-center"
                role="img"
                aria-label={
                  isAr
                    ? "مثال توضيحي لشكل لوحة التحكم — الأرقام للعرض فقط"
                    : "An illustration of the dashboard — the figures are for display only"
                }
              >

                {/* Blue glow behind the mockup */}
                <div
                  aria-hidden
                  className="absolute inset-4 rounded-[var(--radius-xl)] pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 90% 80% at 50% 40%, rgba(14,127,94,0.14) 0%, transparent 70%)",
                    filter: "blur(20px)",
                  }}
                />

                {/* Mockup card */}
                <div
                  className="w-full rounded-[var(--radius-xl)] overflow-hidden relative"
                  style={{
                    background: "var(--color-ink)",
                    border:     "1px solid rgba(255,255,255,0.07)",
                    boxShadow:  "0 32px 80px rgba(17,32,28,0.30), 0 8px 24px rgba(17,32,28,0.16)",
                  }}
                >

                  {/* Top bar */}
                  <div
                    className="flex items-center justify-between px-5 py-3.5"
                    style={{
                      background:   "var(--color-night-2)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--color-jade)" }}
                      >
                        <LayoutDashboard size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[0.6875rem]" >
                          Maw3ed Dashboard
                        </p>
                        <p style={{ color: "var(--color-muted)", fontSize: 10 }}>
                          {isAr ? "نشاطك" : "Your business"}
                        </p>
                      </div>
                    </div>
                    {/*
                      This said "Live" beside a green dot, next to 124
                      bookings and a 4.9 rating that are drawn, not
                      measured. The numbers are fine as an illustration
                      of the dashboard; the badge was what made them
                      read as somebody's actual figures.
                    */}
                    <span
                      style={{ color: "var(--color-muted)", fontSize: 10 }}
                      className="rounded-full px-2 py-0.5"
                    >
                      {isAr ? "مثال توضيحي" : "Example"}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 p-4">
                    {[
                      { label: isAr ? "الحجوزات"  : "Bookings", value: isAr ? "124" : "124", delta: "+12%", color: "var(--color-jade)" },
                      { label: isAr ? "التقييم"   : "Rating",   value: "4.9 ★",               delta: "+0.2",  color: "var(--color-star)" },
                      { label: isAr ? "العملاء"   : "Customers", value: isAr ? "89"  : "89",   delta: "+8",    color: "var(--color-ok)" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-[var(--radius-lg)] p-3"
                        style={{ background: "var(--color-night-2)" }}
                      >
                        <p style={{ color: "var(--color-muted)" }} className="mb-1 text-[0.625rem]">{s.label}</p>
                        <p className="font-extrabold text-base" style={{ color: s.color }}>{s.value}</p>
                        <p style={{ color: "var(--color-ok)" }} className="mt-0.5 text-[0.625rem]">{s.delta}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bookings list */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-bold text-[0.6875rem]" >
                        {isAr ? "حجوزات اليوم" : "Today's Bookings"}
                      </p>
                      <span style={{ color: "var(--color-jade)", fontSize: 10 }}>
                        {isAr ? "الكل ←" : "See all →"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: isAr ? "محمد أحمد"  : "Mohamed Ahmed",  svc: isAr ? "كشف باطنة" : "General Check", time: isAr ? "11:00 ص" : "11:00 AM", ok: true  },
                        { name: isAr ? "فاطمة علي"  : "Fatma Ali",       svc: isAr ? "استشارة"   : "Consultation",  time: isAr ? "12:30 م" : "12:30 PM", ok: false },
                        { name: isAr ? "كريم محمود" : "Karim Mahmoud",  svc: isAr ? "كشف قلبي" : "Cardiac Check", time: isAr ? "2:00 م"  : "2:00 PM",  ok: true  },
                      ].map((row, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 rounded-[var(--radius-md)] p-2.5"
                          style={{ background: "var(--color-night-2)" }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-[0.625rem]"
                            style={{ background: "var(--color-ink-2)" }}
                          >
                            {row.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-white font-semibold truncate text-[0.6875rem]"
                              >
                              {row.name}
                            </p>
                            <p className="truncate text-[0.625rem]" style={{ color: "var(--color-muted)" }}>
                              {row.svc} · {row.time}
                            </p>
                          </div>
                          <span
                            className="rounded-full font-bold shrink-0"
                            style={{
                              fontSize:   9,
                              padding:    "2px 8px",
                              background: row.ok
                                ? "rgba(10,95,71,0.15)"
                                : "rgba(217,164,65,0.15)",
                              color: row.ok ? "var(--color-ok)" : "var(--color-star)",
                            }}
                          >
                            {row.ok
                              ? (isAr ? "مؤكد"   : "Confirmed")
                              : (isAr ? "انتظار" : "Pending")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Auto-reminder notification */}
                  <div
                    className="mx-4 my-4 rounded-[var(--radius-lg)] p-3 flex items-center gap-3"
                    style={{
                      background: "rgba(14,127,94,0.10)",
                      border:     "1px solid rgba(14,127,94,0.18)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                      style={{ background: "var(--color-jade)" }}
                    >
                      <Bell size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-[0.625rem]" >
                        {isAr ? "تذكير تلقائي أُرسل ✓" : "Auto reminder sent ✓"}
                      </p>
                      <p style={{ color: "var(--color-muted)", fontSize: 10 }}>
                        {isAr
                          ? "3 عملاء · مواعيد الغد"
                          : "3 customers · tomorrow's appointments"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bottom row: remaining 3 benefits ── */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {fb.benefits.slice(3).map((b, i) => {
                const { Icon, iconBg } = BENEFIT_ICONS[i + 3];
                return (
                  <div
                    key={b.title}
                    className="rounded-[var(--radius-xl)] bg-white flex flex-col gap-4 p-6 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                    style={{
                      border:     "1px solid var(--color-line)",
                      boxShadow:  "0 1px 4px rgba(17,32,28,0.04), 0 4px 16px rgba(17,32,28,0.03)",
                      transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-[var(--radius-lg)] flex items-center justify-center"
                      style={{ background: iconBg }}
                    >
                      <Icon size={22} strokeWidth={1.75} className="text-white" />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-extrabold text-[var(--color-ink)] mb-1.5"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {b.title}
                      </h3>
                      <p className="text-sm text-[var(--color-muted)] leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* How it works */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">{fb.stepsEyebrow}</p>
              <h2 className="section-title mb-4">{fb.stepsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {fb.steps.map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-brand)] text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-card)]">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{step.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Businesses already on Maw3ed.
            This replaced three testimonials from people who do not
            exist — "د. أحمد محمد" reporting a 40% drop in no-shows, and
            two others — invented quotes under invented names. Everything
            below is read from the database: these businesses are really
            on the platform, and that is the whole claim being made. */}
        {businesses.length > 0 && (
          <section className="section-padding">
            <Container>
              <div className="text-center max-w-xl mx-auto mb-10">
                <p className="section-eyebrow mb-2">{fb.realEyebrow}</p>
                <h2 className="section-title mb-4">
                  {total === null ? fb.realTitleNoCount : countText(lang, total, fb.realTitle)}
                </h2>
              </div>

              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {businesses.map((b) => (
                  <li key={b.slug}>
                    <Link
                      href={`/company/${b.slug}`}
                      className="card card-hover flex items-center gap-3.5 p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-3)] text-[0.9375rem] font-bold text-[var(--color-muted)]"
                      >
                        {b.logoImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cdnImage(b.logoImage, 96)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          (isAr ? b.nameAr : b.nameEn ?? b.nameAr).charAt(0)
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-ink)]">
                          {isAr ? b.nameAr : b.nameEn ?? b.nameAr}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.78125rem] text-[var(--color-subtle)]">
                          {isAr ? b.categoryAr : b.categoryEn || b.categoryAr} · {isAr ? b.cityAr : b.cityEn || b.cityAr}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        )}

        {/* CTA */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="section-eyebrow mb-2">{fb.ctaEyebrow}</p>
                <h2 className="section-title mb-4">{fb.ctaTitle}</h2>
                <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">{fb.ctaSub}</p>
                <ul className="space-y-2.5 mb-8">
                  {fb.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2.5">
                      <CheckCircle size={17} className="text-[var(--color-ok)] shrink-0" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/signup?type=business" className="btn btn-primary btn-lg">{fb.ctaBtn1}</Link>
                  <Link href="/pricing" className="btn btn-outline btn-lg">{fb.ctaBtn2}</Link>
                </div>
              </div>

              <div className="card p-8 border-2 border-[var(--color-accent)] bg-[var(--color-accent-light)]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-[var(--color-accent)]" />
                  <span className="font-semibold text-[var(--color-accent)] text-sm">{fb.freePlanTitle}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-extrabold text-[var(--color-text-primary)]">{fb.freePlanPrice}</span>
                  <span className="text-[var(--color-text-secondary)]">{fb.freePlanUnit}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">{fb.freePlanSub}</p>
                <Link href="/signup?type=business" className="btn btn-accent w-full mb-3">{fb.freePlanBtn1}</Link>
                <Link href="/pricing" className="btn btn-ghost w-full text-[var(--color-accent)]">{fb.freePlanBtn2}</Link>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
