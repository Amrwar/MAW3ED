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
 * Compact page header for internal marketing and listing pages.
 * Light ground, editorial heading — the same language as the
 * homepage rather than the old dark navy slab.
 */
export default function PageHero({ badge, title, subtitle, cta }: PageHeroProps) {
  return (
    <section className="border-b border-[var(--color-line)] bg-[var(--color-ground)] pt-20">
      <div className="container-app py-14 text-center">
        {badge && <span className="section-eyebrow">{badge}</span>}

        <h1 className="display-title mx-auto mt-3 max-w-[18ch] text-[clamp(2rem,4.5vw,3rem)]">
          {title}
        </h1>

        {subtitle && (
          <p className="section-subtitle mx-auto mt-5">{subtitle}</p>
        )}

        {cta && <div className="mt-8 flex flex-wrap justify-center gap-3">{cta}</div>}
      </div>
    </section>
  );
}
