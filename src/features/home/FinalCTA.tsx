"use client";

import Link from "@/components/shared/LocaleLink";
import { Search, Store } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The page's one dark close (design S1, chosen 2026-11-06): the promise
 * on one side, and a box each for the two people reading it, a customer
 * and a business owner, on the other. The ground around the card keeps
 * it apart from the dark footer below.
 */
export default function FinalCTA() {
  const { t } = useLanguage();
  const c = t.finalCta;

  // The note is about signing a business up, so it sits in that box.
  const paths = [
    { Icon: Search, label: c.customersLabel, line: c.customerLine, href: "/businesses", cta: c.cta1, primary: true, note: null },
    { Icon: Store, label: c.businessesLabel, line: c.businessLine, href: "/signup?type=business", cta: c.cta2, primary: false, note: c.note },
  ];

  return (
    <section className="bg-[var(--color-ground)] pb-20 pt-16">
      <div className="container-app">
        <div className="relative isolate overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-night)] px-7 py-12 sm:px-14 sm:py-16">
          <span
            aria-hidden="true"
            className="absolute -top-40 end-[-10%] -z-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgb(79_169_139/0.16),transparent_65%)]"
          />

          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <span className="section-eyebrow text-[var(--color-night-subtle)]">{c.eyebrow}</span>
              <h2 className="mt-4 max-w-[18ch] text-[clamp(2rem,4.5vw,2.875rem)] font-light leading-[1.15] tracking-tight text-white">
                {c.title}
                <br />
                {c.titleLine2}
              </h2>
              <p className="mt-5 max-w-[46ch] text-base leading-[1.8] text-[var(--color-night-text)]">
                {c.subtitle}
              </p>
            </div>

            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {paths.map(({ Icon, label, line, href, cta, primary, note }) => (
                <li
                  key={href}
                  className="rounded-[var(--radius-xl)] border border-[var(--color-night-line)] bg-[var(--color-night-2)] p-6 sm:p-7"
                >
                  <p className="m-0 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgb(79_169_139/0.14)] text-[var(--color-night-accent)]"
                    >
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="text-[0.875rem] font-bold uppercase tracking-wide text-white">{label}</span>
                  </p>
                  <p className="m-0 mt-3.5 text-[0.9375rem] text-[var(--color-night-text)]">{line}</p>
                  <Link
                    href={href}
                    className={
                      primary
                        ? "btn btn-pill mt-5 bg-white! font-extrabold! text-[var(--color-ink)]! hover:bg-white/90!"
                        : "btn btn-pill mt-5 border border-[var(--color-night-edge)]! bg-transparent! font-extrabold! text-white! hover:bg-white/10!"
                    }
                  >
                    {cta}
                  </Link>
                  {note && <p className="m-0 mt-4 text-xs text-[var(--color-night-subtle)]">{note}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
