"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import {
  CheckCircle, BarChart3, Bell,
  Globe, Star, Zap, Users,
  CalendarDays, ShieldCheck, LayoutDashboard,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Benefit icon config (gradient backgrounds matching brand) ──────────────
const BENEFIT_ICONS = [
  { Icon: Globe,        iconBg: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" },
  { Icon: CalendarDays, iconBg: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)" },
  { Icon: Bell,         iconBg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)" },
  { Icon: BarChart3,    iconBg: "linear-gradient(135deg, #059669 0%, #34D399 100%)" },
  { Icon: Users,        iconBg: "linear-gradient(135deg, #4338CA 0%, #818CF8 100%)" },
  { Icon: ShieldCheck,  iconBg: "linear-gradient(135deg, #0E7490 0%, #22D3EE 100%)" },
];

export default function ForBusinessPage() {
  const { t, lang } = useLanguage();
  const fb   = t.forBusiness;
  const isAr = lang === "ar";

  const heroTitle = (
    <>
      {fb.heroTitle}{" "}
      <span
        style={{
          background: "linear-gradient(135deg, #60A5FA 0%, #A78BFA 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {fb.heroAccent}
      </span>
    </>
  );

  const heroCta = (
    <div className="flex flex-col sm:flex-row justify-center gap-3">
      <Link
        href="/signup?type=business"
        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 hover:shadow-blue-500/30 transition-all"
        style={{ background: "#3B82F6" }}
      >
        {fb.cta1}
      </Link>
      <Link
        href="/pricing"
        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm border border-white/15 text-white/75 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
      >
        {fb.cta2}
      </Link>
    </div>
  );

  return (
    <>
      <Navbar />
      <main>
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
          style={{ background: "#F8FAFC" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Ambient glows */}
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-48 w-[640px] h-[640px] rounded-full opacity-[0.07]"
              style={{
                insetInlineStart: "20%",
                background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute -bottom-40 w-[400px] h-[400px] rounded-full opacity-[0.05]"
              style={{
                insetInlineEnd: "-4%",
                background: "radial-gradient(circle, #6366F1 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="container-app relative z-10">

            {/* ── Section heading ── */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3B82F6]/25 bg-[#3B82F6]/[0.07] mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                <span
                  className="font-semibold uppercase"
                  style={{ color: "#2563EB", fontSize: 11, letterSpacing: "0.07em" }}
                >
                  {fb.benefitsEyebrow}
                </span>
              </div>
              <h2
                className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black text-[#0F172A] mb-5"
                style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
              >
                {fb.benefitsTitle}
              </h2>
              <p className="text-[#475569] text-lg max-w-xl mx-auto" style={{ lineHeight: 1.75 }}>
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
                      className="rounded-3xl bg-white flex items-start gap-5 p-6"
                      style={{
                        border:     "1px solid #E2E8F0",
                        boxShadow:  "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)",
                        transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.boxShadow   = "0 8px 28px rgba(59,130,246,0.12), 0 2px 8px rgba(15,23,42,0.06)";
                        el.style.transform   = "translateY(-4px)";
                        el.style.borderColor = "rgba(147,197,253,0.70)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.boxShadow   = "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)";
                        el.style.transform   = "translateY(0)";
                        el.style.borderColor = "#E2E8F0";
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: iconBg }}
                      >
                        <Icon size={22} strokeWidth={1.75} className="text-white" />
                      </div>
                      <div>
                        <h3
                          className="text-[15px] font-black text-[#0F172A] mb-1.5"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {b.title}
                        </h3>
                        <p className="text-sm text-[#475569] leading-relaxed">{b.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Dashboard product mockup ── */}
              <div className="relative flex items-start justify-center">

                {/* Blue glow behind the mockup */}
                <div
                  aria-hidden
                  className="absolute inset-4 rounded-3xl pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 90% 80% at 50% 40%, rgba(59,130,246,0.14) 0%, transparent 70%)",
                    filter: "blur(20px)",
                  }}
                />

                {/* Mockup card */}
                <div
                  className="w-full rounded-3xl overflow-hidden relative"
                  style={{
                    background: "#0F172A",
                    border:     "1px solid rgba(255,255,255,0.07)",
                    boxShadow:  "0 32px 80px rgba(15,23,42,0.30), 0 8px 24px rgba(15,23,42,0.16)",
                  }}
                >

                  {/* Top bar */}
                  <div
                    className="flex items-center justify-between px-5 py-3.5"
                    style={{
                      background:   "#1E293B",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "#3B82F6" }}
                      >
                        <LayoutDashboard size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold" style={{ fontSize: 11 }}>
                          Maw3ed Dashboard
                        </p>
                        <p style={{ color: "#64748B", fontSize: 10 }}>
                          {isAr ? "عيادة د. أحمد سيد" : "Dr. Ahmed's Clinic"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span style={{ color: "#64748B", fontSize: 10 }}>Live</span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 p-4">
                    {[
                      { label: isAr ? "الحجوزات"  : "Bookings", value: isAr ? "١٢٤" : "124", delta: "+12%", color: "#3B82F6" },
                      { label: isAr ? "التقييم"   : "Rating",   value: "4.9 ★",               delta: "+0.2",  color: "#F59E0B" },
                      { label: isAr ? "العملاء"   : "Clients",  value: isAr ? "٨٩"  : "89",   delta: "+8",    color: "#22C55E" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl p-3"
                        style={{ background: "#1E293B" }}
                      >
                        <p style={{ color: "#64748B", fontSize: 10 }} className="mb-1">{s.label}</p>
                        <p className="font-black text-base" style={{ color: s.color }}>{s.value}</p>
                        <p style={{ color: "#22C55E", fontSize: 10 }} className="mt-0.5">{s.delta}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bookings list */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-bold" style={{ fontSize: 11 }}>
                        {isAr ? "حجوزات اليوم" : "Today's Bookings"}
                      </p>
                      <span style={{ color: "#3B82F6", fontSize: 10 }}>
                        {isAr ? "الكل ←" : "See all →"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: isAr ? "محمد أحمد"  : "Mohamed Ahmed",  svc: isAr ? "كشف باطنة" : "General Check", time: isAr ? "١١:٠٠ ص" : "11:00 AM", ok: true  },
                        { name: isAr ? "فاطمة علي"  : "Fatma Ali",       svc: isAr ? "استشارة"   : "Consultation",  time: isAr ? "١٢:٣٠ م" : "12:30 PM", ok: false },
                        { name: isAr ? "كريم محمود" : "Karim Mahmoud",  svc: isAr ? "كشف قلبي" : "Cardiac Check", time: isAr ? "٢:٠٠ م"  : "2:00 PM",  ok: true  },
                      ].map((row, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 rounded-xl p-2.5"
                          style={{ background: "#1E293B" }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                            style={{ background: "#334155", fontSize: 10 }}
                          >
                            {row.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-white font-semibold truncate"
                              style={{ fontSize: 11 }}
                            >
                              {row.name}
                            </p>
                            <p className="truncate" style={{ color: "#64748B", fontSize: 10 }}>
                              {row.svc} · {row.time}
                            </p>
                          </div>
                          <span
                            className="rounded-full font-bold shrink-0"
                            style={{
                              fontSize:   9,
                              padding:    "2px 8px",
                              background: row.ok
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(245,158,11,0.15)",
                              color: row.ok ? "#22C55E" : "#F59E0B",
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
                    className="mx-4 my-4 rounded-2xl p-3 flex items-center gap-3"
                    style={{
                      background: "rgba(59,130,246,0.10)",
                      border:     "1px solid rgba(59,130,246,0.18)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "#3B82F6" }}
                    >
                      <Bell size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold" style={{ fontSize: 10 }}>
                        {isAr ? "تذكير تلقائي أُرسل ✓" : "Auto reminder sent ✓"}
                      </p>
                      <p style={{ color: "#64748B", fontSize: 10 }}>
                        {isAr
                          ? "٣ عملاء · مواعيد الغد"
                          : "3 clients · tomorrow's appointments"}
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
                    className="rounded-3xl bg-white flex flex-col gap-4 p-6"
                    style={{
                      border:     "1px solid #E2E8F0",
                      boxShadow:  "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)",
                      transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.boxShadow   = "0 8px 28px rgba(59,130,246,0.12), 0 2px 8px rgba(15,23,42,0.06)";
                      el.style.transform   = "translateY(-4px)";
                      el.style.borderColor = "rgba(147,197,253,0.70)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.boxShadow   = "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)";
                      el.style.transform   = "translateY(0)";
                      el.style.borderColor = "#E2E8F0";
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: iconBg }}
                    >
                      <Icon size={22} strokeWidth={1.75} className="text-white" />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-black text-[#0F172A] mb-1.5"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {b.title}
                      </h3>
                      <p className="text-sm text-[#475569] leading-relaxed">{b.description}</p>
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
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)] text-white text-xl font-black flex items-center justify-center mx-auto mb-4 shadow-sm">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{step.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Testimonials */}
        <section className="section-padding">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">{fb.testimonialsEyebrow}</p>
              <h2 className="section-title mb-4">{fb.testimonialsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {fb.testimonials.map((t) => (
                <div key={t.name} className="card p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-semibold text-sm text-[var(--color-text-primary)]">{t.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

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
                      <CheckCircle size={17} className="text-green-500 shrink-0" />
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
                  <span className="text-4xl font-black text-[var(--color-text-primary)]">{fb.freePlanPrice}</span>
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
