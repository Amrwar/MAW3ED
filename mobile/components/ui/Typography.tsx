import { Text as RNText } from "react-native";
import type { TextProps } from "react-native";
import { colors, typography } from "@/constants/theme";

type Variant = keyof typeof typography;
type Tone = "ink" | "muted" | "subtle" | "inverse" | "jade" | "danger";

const TONES: Record<Tone, string> = {
  ink: colors.ink,
  muted: colors.muted,
  subtle: colors.subtle,
  inverse: colors.inverse,
  jade: colors.jade,
  danger: colors.danger,
};

/**
 * Text, from the scale.
 *
 * Exists so a screen cannot invent a seventeenth font size. Every
 * variant and tone here is one the design system defines, and anything
 * that needs something else is a sign the system is missing a case
 * rather than that this component needs a style prop.
 *
 * `allowFontScaling` stays on — it is the setting people with poor
 * eyesight use, and turning it off to protect a layout is choosing the
 * layout over the reader.
 */
export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const base = typography[variant];
  return (
    <RNText
      {...rest}
      allowFontScaling
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: base.fontWeight,
          color: TONES[tone],
          // Arabic reads right to left; "auto" lets the runtime decide
          // per string, so a mixed Arabic/Latin label still reads
          // correctly either way.
          writingDirection: "auto",
        },
        style,
      ]}
    />
  );
}
