import type { ReactNode } from "react";

interface PageHeroProps {
  badge?:    string;
  title:     ReactNode;
  subtitle?: string;
  cta?:      ReactNode;
  /** Kept for call-site compatibility; direction comes from <html>. */
  dir?:      "ltr" | "rtl";
}

/**
 * The opening band on an internal page.
 *
 * A light jade wash (.hero-wash), the same as the home page's hero:
 * the header above is dark, and a hero in the header's own colour
 * merged with it into one block, with no edge where the bar ended and
 * the page began.
 */
export default function PageHero({ badge, title, subtitle, cta }: PageHeroProps) {
  return (
    <section className="hero-wash pt-20">
      <div className="container-app py-16 text-center">
        {badge && (
          <span className="section-eyebrow hero-pill">{badge}</span>
        )}

        <h1 className="display-title mx-auto mt-3 max-w-[18ch] text-[clamp(2rem,4.5vw,3rem)] text-[var(--color-ink)]">
          {title}
        </h1>

        {subtitle && (
          <p className="section-subtitle mx-auto mt-5 text-[var(--color-muted)]">
            {subtitle}
          </p>
        )}

        {cta && <div className="mt-8 flex flex-wrap justify-center gap-3">{cta}</div>}
      </div>
    </section>
  );
}
