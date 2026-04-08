"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Search, CalendarDays, CheckCircle2,
  Store, Share2, TrendingUp,
} from "lucide-react";

// ─── Icon sets ──────────────────────────────────────────────

const CUSTOMER_ICONS = [Search, CalendarDays, CheckCircle2];
const BUSINESS_ICONS = [Store, Share2, TrendingUp];

// Per-step gradient for icon containers
const ICON_GRADIENTS = [
  "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #6366F1 100%)",
  "linear-gradient(135deg, #0369A1 0%, #38BDF8 100%)",
];

// ─── Component ─────────────────────────────────────────────

export default function HowItWorks() {
  const { t, lang } = useLanguage();
  const h = t.howItWorks;
  const [tab, setTab] = useState<"customer" | "business">("customer");

  const steps = tab === "customer" ? h.customerSteps : h.businessSteps;
  const icons = tab === "customer" ? CUSTOMER_ICONS : BUSINESS_ICONS;

  return (
    <section
      className="relative overflow-hidden"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >

      {/* ── Dark navy background ───────────────────────────── */}
      <div className="absolute inset-0" style={{ background: "#0B1628" }} />

      {/* Dot grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.07) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* Central blue radial glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "30%", left: "50%", transform: "translateX(-50%)",
          width: 900, height: 700,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, transparent 65%)",
          filter: "blur(2px)",
        }}
      />

      {/* Side glows */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-5%", insetInlineStart: "-8%",
          width: 450, height: 450,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "0%", insetInlineEnd: "-8%",
          width: 450, height: 450,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 65%)",
        }}
      />

      {/* ── Content ───────────────────────────────────────── */}
      <div className="relative z-20 py-20 lg:py-28">
        <div className="container-app">

          {/* ── Section header ── */}
          <div className="text-center mb-12 lg:mb-14">

            {/* Eyebrow badge — frosted on dark */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
              style={{
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.28)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]"
                style={{ boxShadow: "0 0 6px rgba(96,165,250,0.7)" }}
              />
              <span className="text-[#93C5FD] text-xs font-semibold tracking-widest uppercase">
                {h.eyebrow}
              </span>
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4"
              style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
            >
              {h.title}
            </h2>
            <p
              className="text-[#94A3B8] text-lg max-w-lg mx-auto"
              style={{ lineHeight: 1.75 }}
            >
              {h.subtitle}
            </p>
          </div>

          {/* ── Toggle ── */}
          <div className="flex justify-center mb-16">
            <div
              className="inline-flex p-1.5 rounded-2xl gap-1"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                backdropFilter: "blur(8px)",
              }}
            >
              {(["customer", "business"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTab(mode)}
                  className="px-7 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={
                    tab === mode
                      ? {
                          background: "#3B82F6",
                          color: "#ffffff",
                          boxShadow: "0 4px 16px rgba(59,130,246,0.45)",
                        }
                      : {
                          color: "#94A3B8",
                        }
                  }
                >
                  {mode === "customer" ? h.forCustomers : h.forBusinesses}
                </button>
              ))}
            </div>
          </div>

          {/* ── Steps timeline ── */}
          <div className="grid md:grid-cols-3 gap-6 relative">

            {/* Dashed connecting line (desktop only) */}
            <div
              aria-hidden
              className="hidden md:block absolute pointer-events-none"
              style={{
                top: 28,                   /* center of 56px number circle */
                left: "16.667%",
                right: "16.667%",
                borderTop: "1.5px dashed rgba(59,130,246,0.28)",
              }}
            />

            {steps.map((step, i) => {
              const Icon = icons[i];
              return (
                <div key={step.title} className="flex flex-col items-center">

                  {/* ── Number circle (floats above card) ── */}
                  <div
                    className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white mb-5 shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
                      boxShadow:
                        "0 0 0 5px rgba(59,130,246,0.12), 0 0 0 9px rgba(59,130,246,0.06), 0 6px 20px rgba(59,130,246,0.40)",
                    }}
                  >
                    {step.number}
                  </div>

                  {/* ── Step card ── */}
                  <div
                    className="group w-full bg-white rounded-3xl p-7 text-center flex flex-col flex-1"
                    style={{
                      boxShadow: "0 4px 28px rgba(0,0,0,0.28), 0 1px 6px rgba(0,0,0,0.16)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      transition: "box-shadow 0.26s ease, transform 0.26s ease, border-color 0.26s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.boxShadow = "0 16px 48px rgba(59,130,246,0.18), 0 6px 20px rgba(0,0,0,0.18)";
                      el.style.transform = "translateY(-5px)";
                      el.style.borderColor = "rgba(147,197,253,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.boxShadow = "0 4px 28px rgba(0,0,0,0.28), 0 1px 6px rgba(0,0,0,0.16)";
                      el.style.transform = "translateY(0)";
                      el.style.borderColor = "rgba(255,255,255,0.06)";
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                      style={{ background: ICON_GRADIENTS[i] }}
                    >
                      <Icon size={24} className="text-white" strokeWidth={1.75} />
                    </div>

                    <h3
                      className="text-base font-bold text-[#0F172A] mb-2"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Mobile vertical connector (all steps except last) */}
                  {i < steps.length - 1 && (
                    <div
                      aria-hidden
                      className="md:hidden mt-4 mb-1"
                      style={{
                        width: 1.5,
                        height: 32,
                        borderLeft: "1.5px dashed rgba(59,130,246,0.3)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
