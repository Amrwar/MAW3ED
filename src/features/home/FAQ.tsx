"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FAQ() {
  const { t, lang } = useLanguage();
  const f = t.faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-4 tracking-wide uppercase">
              {f.eyebrow}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3">{f.title}</h2>
            <p className="text-[#475569] text-lg">{f.subtitle}</p>
          </div>

          {/* Accordion */}
          <div className="space-y-3">
            {f.items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isOpen
                      ? "border-[#3B82F6]/50 bg-white shadow-sm"
                      : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                  }`}
                >
                  <button
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-bold text-[#0F172A] leading-snug">
                      {item.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-[#94A3B8] transition-transform duration-200 ${isOpen ? "rotate-180 text-[#3B82F6]" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5">
                      <div className="h-px bg-[#E2E8F0] mb-4" />
                      <p className="text-sm text-[#475569] leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom note */}
          <div className="mt-10 text-center p-6 rounded-2xl bg-white border border-[#E2E8F0]">
            <p className="text-sm font-semibold text-[#0F172A] mb-1">{f.notFoundTitle}</p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 mt-3 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
              style={{ background: "#3B82F6" }}
            >
              {f.contactBtn}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
