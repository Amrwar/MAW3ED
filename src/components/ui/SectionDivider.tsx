/**
 * SectionDivider — reusable section transition system for Maw3ed homepage.
 *
 * Variants
 * ─────────
 * fade   Simple linear gradient between two section backgrounds.
 *        Use for subtle transitions between same-family colors (light→light, dark→dark).
 *
 * curve  SVG wave where the "to" color arches upward from the bottom center.
 *        Use for high-contrast transitions (dark↔light). The wave creates depth
 *        and makes sections feel like they overlap rather than abut.
 *
 * glow   Gradient blend with a centered blue radial glow and hairline accent.
 *        Use between two dark sections to add visual interest without a hard break.
 *
 * line   A single accent gradient hairline. Use for very subtle structural breaks
 *        inside same-color zones (e.g. before a dark CTA from a dark section).
 *
 * SectionGlow
 * ───────────
 * A radial glow helper for use inside section backgrounds (absolute positioned).
 * Import and drop inside any section that needs a soft ambient light accent.
 */

// No "use client" — purely presentational, no interactivity.

type Variant = "fade" | "curve" | "glow" | "line";

// ─── Brand tokens (duplicated here so the component is self-contained) ───────
const ACCENT  = "var(--color-jade)";
const LIGHT   = "var(--color-surface-2)";

// ─── SectionDivider ───────────────────────────────────────────────────────────

interface SectionDividerProps {
  /** Visual treatment. Default: "fade". */
  variant?: Variant;
  /** Background color of the section above (defaults to brand light). */
  from?: string;
  /** Background color of the section below (defaults to brand light). */
  to?: string;
  /**
   * Height in px.
   * Defaults: curve=80, fade=48, glow=64, line=24.
   */
  height?: number;
  /**
   * Mirror the wave horizontally.
   * Useful when you want the arch crest to sit on one side instead of center.
   */
  flip?: boolean;
  /** Override the accent color used in glow/line variants. */
  accent?: string;
  className?: string;
}

export function SectionDivider({
  variant = "fade",
  from    = LIGHT,
  to      = LIGHT,
  height,
  flip    = false,
  accent  = ACCENT,
  className = "",
}: SectionDividerProps) {

  // ── Defaults per variant ───────────────────────────────────────────────────
  const h = height ?? { fade: 48, curve: 80, glow: 64, line: 24 }[variant];

  // ── fade ───────────────────────────────────────────────────────────────────
  if (variant === "fade") {
    return (
      <div
        className={className}
        aria-hidden
        style={{
          height:     h,
          background: `linear-gradient(to bottom, ${from}, ${to})`,
          display:    "block",
        }}
      />
    );
  }

  // ── curve ──────────────────────────────────────────────────────────────────
  // SVG wave: `to` color arches UP from the bottom, reaching y=0 at the center.
  // The divider's own background is `from` so the section above bleeds in
  // seamlessly, and the wave represents the next section rising to meet it.
  if (variant === "curve") {
    const halfH = Math.round(h * 0.5);
    // Control points at 75% and 25% of width → smooth single arch
    const cp1x  = Math.round(1440 * 0.75); // 1080
    const cp2x  = Math.round(1440 * 0.25); // 360
    // Path: spans full bottom, sides rise to halfH, center arch reaches y=0
    const d     = `M0,${h} L1440,${h} L1440,${halfH} C${cp1x},0 ${cp2x},0 0,${halfH} Z`;

    return (
      <div
        aria-hidden
        className={`relative overflow-hidden ${className}`}
        style={{ height: h, background: from }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 1440 ${h}`}
          preserveAspectRatio="none"
          style={{
            display:   "block",
            transform: flip ? "scaleX(-1)" : undefined,
          }}
        >
          <path d={d} fill={to} />
        </svg>
      </div>
    );
  }

  // ── glow ───────────────────────────────────────────────────────────────────
  // Gradient blend + centered radial accent + hairline. Good for dark→dark.
  if (variant === "glow") {
    return (
      <div
        aria-hidden
        className={`relative overflow-hidden ${className}`}
        style={{ height: h, background: from }}
      >
        {/* Gradient blend when colors differ */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${from} 0%, ${to} 100%)`,
          }}
        />

        {/* Radial accent glow — horizontal ellipse at center */}
        <div
          className="absolute pointer-events-none"
          style={{
            top:       "50%",
            left:      "50%",
            transform: "translate(-50%, -50%)",
            width:     720,
            height:    h * 2,
            background: `radial-gradient(ellipse at center, ${accent}35 0%, transparent 60%)`,
          }}
        />

        {/* Hairline accent */}
        <div
          className="absolute"
          style={{
            top:        "50%",
            left:       "8%",
            right:      "8%",
            height:     1,
            transform:  "translateY(-50%)",
            background: `linear-gradient(to right, transparent, ${accent}40, ${accent}65, ${accent}40, transparent)`,
          }}
        />
      </div>
    );
  }

  // ── line ───────────────────────────────────────────────────────────────────
  // Single gradient hairline — minimal structural break.
  if (variant === "line") {
    return (
      <div
        aria-hidden
        className={`relative ${className}`}
        style={{ height: h, background: from, display: "flex", alignItems: "center" }}
      >
        <div
          style={{
            flex:       1,
            height:     1,
            margin:     "0 5%",
            background: `linear-gradient(to right, transparent, ${accent}35, ${accent}55, ${accent}35, transparent)`,
          }}
        />
      </div>
    );
  }

  return null;
}

// ─── SectionGlow ─────────────────────────────────────────────────────────────
// Drop inside a `relative overflow-hidden` section to add a soft ambient light.

interface SectionGlowProps {
  /** Glow color — defaults to brand accent. */
  color?:    string;
  /** Diameter of the glow circle in px. */
  size?:     number;
  /** Horizontal center as a CSS value, e.g. "50%", "0%", "30%". */
  x?:        string;
  /** Vertical center as a CSS value. */
  y?:        string;
  /** Overall opacity (0–1). */
  opacity?:  number;
  /** Extra className for positioning overrides. */
  className?: string;
}

export function SectionGlow({
  color    = ACCENT,
  size     = 600,
  x        = "50%",
  y        = "50%",
  opacity  = 0.07,
  className = "",
}: SectionGlowProps) {
  return (
    <div
      aria-hidden
      className={`absolute pointer-events-none ${className}`}
      style={{
        left:         x,
        top:          y,
        transform:    "translate(-50%, -50%)",
        width:        size,
        height:       size,
        borderRadius: "50%",
        background:   `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity,
      }}
    />
  );
}
