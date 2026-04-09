"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import {
  CheckCircle, Calendar, BarChart3, Bell,
  Globe, Star, Shield, Zap, Users,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const benefitIcons = [Globe, Calendar, Bell, BarChart3, Users, Shield];
const benefitColors = [
  "text-blue-500 bg-blue-50","text-green-500 bg-green-50","text-purple-500 bg-purple-50",
  "text-orange-500 bg-orange-50","text-pink-500 bg-pink-50","text-teal-500 bg-teal-50",
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

        {/* Benefits */}
        <section className="section-padding">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">{fb.benefitsEyebrow}</p>
              <h2 className="section-title mb-4">{fb.benefitsTitle}</h2>
              <p className="section-subtitle mx-auto">{fb.benefitsSub}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {fb.benefits.map((b, i) => {
                const Icon = benefitIcons[i];
                const [textColor, bgColor] = benefitColors[i].split(" ");
                return (
                  <div key={b.title} className="card p-6 hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200">
                    <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center mb-4`}>
                      <Icon size={22} className={textColor} />
                    </div>
                    <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{b.title}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{b.description}</p>
                  </div>
                );
              })}
            </div>
          </Container>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
