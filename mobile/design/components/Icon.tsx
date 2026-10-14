// The one set used. The @expo/vector-icons barrel bundles all 19 icon
// fonts (about 3 MB); this path bundles only Ionicons.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { colors, iconSize } from "../tokens";
import { useLocale } from "../locale";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * Icons that point somewhere. In Arabic "forward" is leftward, so these
 * are mirrored whenever the layout is RTL — a "next" chevron must point
 * the way the next thing is. Icons of objects (a calendar, a heart, a
 * bell) are never mirrored; a mirrored clock is wrong in every language.
 */
const DIRECTIONAL = new Set<string>([
  // Base names; the "-outline" variants are matched by stripping it.
  "chevron-forward",
  "chevron-back",
  "arrow-forward",
  "arrow-back",
  "caret-forward",
  "caret-back",
  "return-up-back",
  "return-up-forward",
  "log-out",
  "log-in",
  "open",
  "send",
]);

/**
 * The icon set. Ionicons, already bundled with Expo, so there is one
 * visual language and no second icon font.
 *
 * Decorative by default — hidden from screen readers, because the
 * control it sits in carries the label. Pass `label` for an icon that
 * stands alone and means something.
 */
export function Icon({
  name,
  size = "md",
  color = colors.ink,
  label,
}: {
  name: IconName;
  size?: keyof typeof iconSize | number;
  color?: string;
  label?: string;
}) {
  const { isRTL } = useLocale();
  const px = typeof size === "number" ? size : iconSize[size];
  const flip = isRTL && DIRECTIONAL.has(name.replace(/-outline$/, "")) ? [{ scaleX: -1 }] : undefined;

  return (
    <Ionicons
      name={name}
      size={px}
      color={color}
      style={flip ? { transform: flip } : undefined}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      accessibilityElementsHidden={!label}
    />
  );
}

/** Whether an icon is mirrored in RTL. Exported for the tests. */
export function isDirectional(name: string): boolean {
  return DIRECTIONAL.has(name.replace(/-outline$/, ""));
}
