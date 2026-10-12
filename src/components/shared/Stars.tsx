import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * A row of five stars with `value` of them filled. Drawn by the `.stars`
 * rule in globals.css from a single masked shape rather than five SVGs.
 *
 * Decorative: it is aria-hidden, so the caller labels the rating — the
 * places that use it already wrap it in role="img" with "4 out of 5".
 */
export default function Stars({
  value,
  size = 14,
  className,
}: {
  /** 0–5. A fraction fills that share of the next star. */
  value: number;
  size?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(5, value));
  const whole = Math.floor(v);
  const part = v - whole;
  // Whole stars plus the gap after each, then a share of the next star:
  // the boundary always lands in a gap or inside the star being filled.
  const style = {
    "--fill": `calc(${whole} * (var(--star-size) + var(--star-gap)) + ${part.toFixed(2)} * var(--star-size))`,
    "--star-size": `${size}px`,
  } as CSSProperties;

  return <span aria-hidden="true" className={cn("stars", className)} style={style} />;
}
