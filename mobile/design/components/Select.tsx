import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "../tokens";
import { useLocale } from "../locale";
import { joinLabel } from "../strings";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { Touchable } from "./Touchable";
import { Sheet } from "./Sheet";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/**
 * A dropdown. On a phone the list opens as a sheet of large rows — a
 * native-looking popover menu of 14pt items is hard to hit and harder
 * to read in Arabic. Each row is a radio button, so the choice is
 * announced with its state.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const { t, lang } = useLocale();
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="ink2">
        {label}
      </Text>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? placeholder ?? t("select")}`}
        accessibilityHint={t("select")}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Text variant="body" tone={chosen ? "ink" : "subtle"} style={styles.value} numberOfLines={1}>
          {chosen?.label ?? placeholder ?? t("select")}
        </Text>
        <Icon name="chevron-down" color={colors.subtle} />
      </Touchable>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <View accessibilityRole="radiogroup">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Touchable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={joinLabel(lang, o.label, o.description)}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[styles.option, selected && styles.optionOn]}
              >
                <View style={styles.optionText}>
                  <Text variant={selected ? "bodyBold" : "body"}>{o.label}</Text>
                  {o.description ? (
                    <Text variant="caption" tone="subtle">
                      {o.description}
                    </Text>
                  ) : null}
                </View>
                {selected ? <Icon name="checkmark-circle" color={colors.jade} /> : null}
              </Touchable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  field: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  value: { flex: 1 },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  optionOn: { backgroundColor: colors.jadeTint },
  optionText: { flex: 1, gap: spacing.xxs },
});
