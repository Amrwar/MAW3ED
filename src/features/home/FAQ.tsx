"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FAQ() {
  const { t } = useLanguage();
  const f = t.faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">

        <div className="mb-10 flex flex-col items-center text-center">
          <span className="section-eyebrow">{f.eyebrow}</span>
          <h2 className="section-title mt-2.5">{f.title}</h2>
          <p className="section-subtitle mx-auto mt-4">{f.subtitle}</p>
        </div>

        <div className="mx-auto flex max-w-[48rem] flex-col gap-2.5">
          {f.items.map((item, i) => {
            const isOpen = open === i;
            const panelId = `faq-panel-${i}`;
            const btnId = `faq-btn-${i}`;

            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]"
              >
                <h3 className="m-0">
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-5 px-6 py-5 text-start"
                  >
                    <span className="text-[0.96875rem] font-bold text-[var(--color-ink)]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted)]"
                    >
                      {isOpen ? <Minus size={15} strokeWidth={2.2} /> : <Plus size={15} strokeWidth={2.2} />}
                    </span>
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className="px-6 pb-6"
                  >
                    <p className="m-0 max-w-[62ch] text-[0.90625rem] leading-[1.85] text-[var(--color-muted)]">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <p className="m-0 text-sm text-[var(--color-muted)]">{f.notFoundTitle}</p>
          <Link href="/contact" className="btn btn-outline btn-pill btn-sm">
            {f.contactBtn}
          </Link>
        </div>
      </div>
    </section>
  );
}
