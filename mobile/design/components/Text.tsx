import { Text as RNText } from "react-native";
import type { TextProps } from "react-native";
import { colors, maxFontScale, typography, type TypeVariant } from "../tokens";
import { useLocale } from "../locale";

/** Text colours. Each is a pairing the contrast test checks on its usual ground. */
export type TextTone =
  | "ink"
  | "ink2"
  | "muted"
  | "subtle"
  | "inverse"
  | "inverseMuted"
  | "jade"
  | "danger"
  | "warn"
  | "ok";

const TONES: Record<TextTone, string> = {
  ink: colors.ink,
  ink2: colors.ink2,
  muted: colors.muted,
  subtle: colors.subtle,
  inverse: colors.inverse,
  inverseMuted: colors.nightText,
  jade: colors.jade,
  danger: colors.danger,
  warn: colors.warn,
  ok: colors.ok,
};

/**
 * Text, from the scale.
 *
 * A screen cannot invent a seventeenth size: every variant and tone is
 * one the system defines, and needing something else means the system
 * is missing a case.
 *
 * Alignment is "start", resolved from the locale — right in Arabic,
 * left in English — so no screen aligns text by hand. `center` and
 * `end` are there for the cases that mean it.
 *
 * Font scaling stays on: it is the setting people with poor eyesight
 * use. Each variant caps how far it grows (tokens.maxFontScale), so
 * large text enlarges without a heading swallowing the screen.
 */
export function Text({
  variant = "body",
  tone = "ink",
  align = "start",
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: TextTone; align?: "start" | "center" | "end" }) {
  const { isRTL } = useLocale();
  const base = typography[variant];
  const textAlign =
    align === "center" ? "center" : (align === "start") === isRTL ? "right" : "left";

  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      allowFontScaling
      style={[
        base,
        {
          color: TONES[tone],
          textAlign,
          writingDirection: isRTL ? "rtl" : "ltr",
        },
        style,
      ]}
    />
  );
}
