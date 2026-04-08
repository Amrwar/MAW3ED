"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function FAQ() {
  const { t, lang } = useLanguage();
  const f    = t.faq;
  const isAr = lang === "ar";
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Subtle background glows ── */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%", left: "50%", transform: "translateX(-50%)",
          width: 700, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 65%)",
          filter: "blur(2px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-5%", insetInlineEnd: "5%",
          width: 350, height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 container-app">
        <div className="max-w-2xl mx-auto">

          {/* ── Section header ── */}
          <div className="text-center mb-12">

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-[#DBEAFE] border border-[#BFDBFE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              <span className="text-[#3B82F6] text-xs font-semibold tracking-widest uppercase">
                {f.eyebrow}
              </span>
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] mb-4"
              style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
            >
              {f.title}
            </h2>
            <p className="text-[#475569] text-lg" style={{ lineHeight: 1.75 }}>
              {f.subtitle}
            </p>
          </div>

          {/* ── Accordion ── */}
          <div className="space-y-2.5">
            {f.items.map((item, i) => {
              const isOpen = open === i;

              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-2xl overflow-hidden transition-all duration-200",
                    isOpen
                      ? "border-s-[3px] border border-[#E2E8F0] border-s-[#3B82F6] bg-white"
                      : "border border-[#E2E8F0] bg-white hover:border-[#CBD5E1]",
                  )}
                  style={{
                    boxShadow: isOpen
                      ? "0 4px 20px rgba(59,130,246,0.08), 0 1px 6px rgba(15,23,42,0.05)"
                      : "0 1px 4px rgba(15,23,42,0.04)",
                  }}
                >

                  {/* Trigger */}
                  <button
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span
                      className={cn(
                        "text-sm font-bold leading-snug transition-colors duration-150",
                        isOpen ? "text-[#1D4ED8]" : "text-[#0F172A]",
                      )}
                    >
                      {item.q}
                    </span>

                    <div
                      className={cn(
                        "shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                        isOpen
                          ? "bg-[#DBEAFE] text-[#3B82F6]"
                          : "bg-[#F1F5F9] text-[#94A3B8]",
                      )}
                    >
                      <ChevronDown
                        size={15}
                        strokeWidth={2.5}
                        className={cn(
                          "transition-transform duration-300",
                          isOpen && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {/* Answer — smooth grid expand */}
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-in-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-5 pt-0">
                        <div
                          className="h-px mb-4"
                          style={{ background: "linear-gradient(to right, rgba(59,130,246,0.20), transparent)" }}
                        />
                        <p
                          className="text-[#475569] leading-relaxed"
                          style={{ fontSize: "0.9375rem", lineHeight: 1.75 }}
                        >
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* ── Support CTA ── */}
          <div
            className="mt-10 rounded-3xl p-8 text-center overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.04) 100%)",
              border:     "1px solid rgba(59,130,246,0.18)",
              boxShadow:  "0 2px 16px rgba(59,130,246,0.07)",
            }}
          >

            {/* Background dot decoration */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.07) 1px, transparent 1px)",
                backgroundSize:  "20px 20px",
              }}
            />

            <div className="relative z-10">

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                  boxShadow:  "0 4px 14px rgba(59,130,246,0.35)",
                }}
              >
                <MessageCircle size={20} className="text-white" strokeWidth={1.75} />
              </div>

              <p
                className="text-base font-bold text-[#0F172A] mb-1.5"
                style={{ letterSpacing: "-0.01em" }}
              >
                {f.notFoundTitle}
              </p>
              <p className="text-sm text-[#475569] mb-5">
                {isAr
                  ? "فريق الدعم جاهز لمساعدتك في أي وقت — بالعربي."
                  : "Our support team is ready to help — in Arabic or English."}
              </p>

              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                  boxShadow:  "0 4px 16px rgba(59,130,246,0.40)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.boxShadow = "0 6px 22px rgba(59,130,246,0.52)";
                  el.style.filter    = "brightness(1.06)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.boxShadow = "0 4px 16px rgba(59,130,246,0.40)";
                  el.style.filter    = "";
                }}
              >
                {f.contactBtn}
                <ArrowRight
                  size={14}
                  strokeWidth={2.5}
                  className={isAr ? "rotate-180" : ""}
                />
              </Link>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
