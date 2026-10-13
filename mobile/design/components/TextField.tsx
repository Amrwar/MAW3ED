import { forwardRef, useId, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius, spacing, touchTarget } from "../tokens";
import { useLocale } from "../locale";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { Touchable } from "./Touchable";

/**
 * A labelled text input.
 *
 * The label is a visible element tied to the input — not a placeholder,
 * which disappears the moment someone starts typing and leaves them
 * guessing what the field was. Errors are shown in words beneath it and
 * announced, never by a red border alone.
 *
 * `ltr` is for content that reads left to right whatever the language —
 * phone numbers, emails, codes — so "01012345678" is not laid out
 * backwards inside an Arabic form.
 */
export const TextField = forwardRef<
  TextInput,
  TextInputProps & {
    label: string;
    hint?: string;
    error?: string | null;
    icon?: IconName;
    ltr?: boolean;
    required?: boolean;
    tone?: "light" | "night";
  }
>(function TextField(
  { label, hint, error, icon, ltr, required, tone = "light", secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { isRTL, t } = useLocale();
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const night = tone === "night";

  const border = error ? colors.danger : focused ? (night ? colors.nightAccent : colors.jade) : night ? colors.nightLine : colors.line2;
  const writesLtr = ltr ?? !isRTL;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone={night ? "inverse" : "ink2"} nativeID={labelId}>
        {label}
        {required ? <Text variant="label" tone="danger">{" *"}</Text> : null}
      </Text>

      <View
        style={[
          styles.field,
          { borderColor: border, backgroundColor: night ? colors.night2 : colors.surface },
          focused && styles.focused,
        ]}
      >
        {icon ? <Icon name={icon} color={night ? colors.nightSubtle : colors.subtle} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          accessibilityHint={error ?? hint}
          accessibilityState={{ disabled: rest.editable === false }}
          placeholderTextColor={night ? colors.nightSubtle : colors.faint}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={[
            styles.input,
            {
              color: night ? colors.inverse : colors.ink,
              textAlign: writesLtr ? "left" : "right",
              writingDirection: writesLtr ? "ltr" : "rtl",
            },
            style,
          ]}
        />
        {secureTextEntry ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t("hidePassword") : t("showPassword")}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={12}
            borderless
          >
            <Icon name={revealed ? "eye-off-outline" : "eye-outline"} color={night ? colors.nightSubtle : colors.subtle} />
          </Touchable>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone={night ? "inverseMuted" : "subtle"}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  field: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  focused: { borderWidth: 2 },
  input: {
    flex: 1,
    minHeight: touchTarget - 4,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
});
