import type { ReactNode } from "react";

interface PageHeroProps {
  badge?:    string;
  title:     ReactNode;
  subtitle?: string;
  cta?:      ReactNode;
  dir?:      "ltr" | "rtl";
}

/**
 * Shared compact hero for all internal marketing pages.
 * Matches the homepage hero's visual language — dark navy, dot grid,
 * blue atmospheric glows — but in a compact centered variant.
 */
export default function PageHero({
  badge,
  title,
  subtitle,
  cta,
  dir = "rtl",
}: PageHeroProps) {
  return (
    <section
      className="relative overflow-hidden pt-16"
      style={{ background: "#0F172A" }}
      dir={dir}
    >
      {/* Dot grid — same density as homepage hero */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Atmospheric glows — same radial language as homepage */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -end-40 w-[500px] h-[500px] rounded-full opacity-[0.18]"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-24 start-0 w-[350px] h-[350px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}
        />
      </div>

      {/* Content */}
      <div className="container-app relative z-10 py-16 lg:py-20 text-center">

        {/* Eyebrow badge — same pill style as homepage */}
        {badge && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            <span className="text-[#93C5FD] text-xs font-semibold tracking-wide">
              {badge}
            </span>
          </div>
        )}

        {/* Heading */}
        <h1
          className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-5"
          style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="text-[#94A3B8] text-lg max-w-xl mx-auto"
            style={{ lineHeight: 1.75 }}
          >
            {subtitle}
          </p>
        )}

        {/* Optional CTA slot */}
        {cta && <div className="mt-8">{cta}</div>}
      </div>

      {/* Bottom fade — softens transition into page content */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(15,23,42,0.5))" }}
      />
    </section>
  );
}
