import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ScrollCue from "./ScrollCue";

interface PageHeroProps {
  badge?:    string;
  title:     ReactNode;
  subtitle?: string;
  cta?:      ReactNode;
  /**
   * Fill the first screen, as the home hero does (default). Off for a
   * page whose hero is only a heading above the tool people came for,
   * like Browse, where a full screen would hide the search and results.
   */
  fill?:     boolean;
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
 *
 * It fills the first screen, content centred: the next section cut
 * off at the fold (the pricing cards half in view) looked unfinished.
 * svh, not vh, so a phone's collapsing address bar does not push it
 * past the screen. The arrow at its foot says the page goes on.
 */
export default function PageHero({ badge, title, subtitle, cta, fill = true }: PageHeroProps) {
  return (
    <section className={cn("hero-wash pt-20", fill && "flex min-h-[100svh] flex-col justify-center")}>
      <div className={cn("container-app w-full text-center", fill ? "pb-24 pt-12" : "py-16")}>
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
      {fill && <ScrollCue />}
    </section>
  );
}
