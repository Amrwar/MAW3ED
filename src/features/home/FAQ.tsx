"use client";

import { useState } from "react";
import Link from "@/components/shared/LocaleLink";
import { Mail, Minus, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

/**
 * Questions (design F2, chosen 2026-11-06): a white band with hairlines,
 * the heading and a way to reach a person on one side, the questions as
 * a plain divided list on the other. The only bordered band in the
 * page's closing run, so no two lines ever sit together.
 */
export default function FAQ() {
  const { t } = useLanguage();
  const f = t.faq;
  const [open, setOpen] = useState<number | null>(0);
  // The address is a link, so the sentence is split around it.
  const [before = "", after = ""] = f.supportBody.split("{email}");

  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)] py-20">
      <div className="container-app">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">

          <div className="min-w-0">
            <span className="section-eyebrow">{f.eyebrow}</span>
            <h2 className="section-title mt-2.5">{f.title}</h2>
            <p className="section-subtitle mt-4">{f.subtitle}</p>

            <div className="mt-10 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-7">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[var(--color-jade)]"
              >
                <Mail size={19} strokeWidth={1.8} />
              </span>
              <h3 className="m-0 mt-5 text-[1.0625rem] font-bold text-[var(--color-ink)]">{f.notFoundTitle}</h3>
              <p className="m-0 mt-2 text-[0.875rem] leading-[1.75] text-[var(--color-muted)]">
                {before}
                <a href={SUPPORT_MAILTO} dir="ltr" className="font-semibold text-[var(--color-jade)] hover:text-[var(--color-jade-hover)]">
                  {SUPPORT_EMAIL}
                </a>
                {after}
              </p>
              <Link href="/contact" className="btn btn-primary btn-pill btn-sm mt-5">
                {f.contactBtn}
              </Link>
            </div>
          </div>

          <div className="min-w-0 border-t border-[var(--color-line)]">
            {f.items.map((item, i) => {
              const isOpen = open === i;
              const panelId = `faq-panel-${i}`;
              const btnId = `faq-btn-${i}`;

              return (
                <div key={item.q} className="border-b border-[var(--color-line)]">
                  <h3 className="m-0">
                    <button
                      id={btnId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex min-h-11 w-full items-center justify-between gap-5 py-5 text-start"
                    >
                      <span className="text-[1rem] font-bold text-[var(--color-ink)]">{item.q}</span>
                      <span aria-hidden="true" className={isOpen ? "shrink-0 text-[var(--color-jade)]" : "shrink-0 text-[var(--color-muted)]"}>
                        {isOpen ? <Minus size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
                      </span>
                    </button>
                  </h3>

                  {isOpen && (
                    <div id={panelId} role="region" aria-labelledby={btnId} className="pb-6 pe-10">
                      <p className="m-0 max-w-[62ch] text-[0.9375rem] leading-[1.85] text-[var(--color-muted)]">
                        {item.a}
                      </p>
                    </div>
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
