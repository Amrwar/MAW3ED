import { useWindowDimensions } from "react-native";
import { breakpoints, maxContentWidth, spacing } from "./tokens";

/**
 * The one answer to "how much room is there".
 *
 * Components adapt to it rather than existing in phone and tablet
 * versions: a list becomes a grid by asking for `columns`, a screen
 * stops stretching by honouring `contentWidth`. Recomputed when the
 * window changes — rotation, split view, a foldable opening.
 */
export interface Layout {
  width: number;
  height: number;
  size: "compact" | "medium" | "expanded";
  isTablet: boolean;
  /** Side gutter for screen content. */
  gutter: number;
  /** How many cards fit side by side for list-like content. */
  columns: 1 | 2 | 3;
  /** The width content should be laid out in — never the full width of a big tablet. */
  contentWidth: number;
  landscape: boolean;
}

export function layoutFor(width: number, height: number): Layout {
  const size = width >= breakpoints.wide ? "expanded" : width >= breakpoints.tablet ? "medium" : "compact";
  const gutter = size === "compact" ? spacing.lg : spacing.xl;
  const contentWidth = Math.min(width - gutter * 2, size === "compact" ? width : maxContentWidth);
  return {
    width,
    height,
    size,
    isTablet: size !== "compact",
    gutter,
    columns: size === "expanded" ? 3 : size === "medium" ? 2 : 1,
    contentWidth,
    landscape: width > height,
  };
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}
