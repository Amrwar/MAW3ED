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
 * Dark, because every page should start the way the home page starts
 * and end the way it ends — the hero and the footer are the same
 * --color-night, and everything between them sits on light ground. This
 * was light for a while, deliberately, to match a home page that was
 * then light; it follows it back rather than drifting away from it.
 *
 * The colours are set on the elements rather than through the
 * section-* classes, which resolve to ink on light and would be
 * unreadable here.
 */
export default function PageHero({ badge, title, subtitle, cta }: PageHeroProps) {
  return (
    <section className="bg-[var(--color-night)] pt-20">
      <div className="container-app py-16 text-center">
        {badge && (
          <span className="section-eyebrow text-[var(--color-night-accent)]">{badge}</span>
        )}

        <h1 className="display-title mx-auto mt-3 max-w-[18ch] text-[clamp(2rem,4.5vw,3rem)] text-[var(--color-inverse)]">
          {title}
        </h1>

        {subtitle && (
          <p className="section-subtitle mx-auto mt-5 text-[var(--color-night-text)]">
            {subtitle}
          </p>
        )}

        {cta && <div className="mt-8 flex flex-wrap justify-center gap-3">{cta}</div>}
      </div>
    </section>
  );
}
