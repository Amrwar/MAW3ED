import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Icon, IconButton, Text, Touchable, colors, ltr, radius, spacing, useLocale, type IconName } from "@/design";
import { num } from "@/lib/format";

/**
 * The pieces the booking screens share. Built from the design system's
 * own parts; nothing here has a colour or size of its own.
 */

/** One answer among several. A radio to a screen reader, with its state. */
export function Choice({
  selected,
  title,
  subtitle,
  photo,
  icon,
  disabled,
  note,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle?: string | null;
  /** A person: their photo, or initials when there is none. */
  photo?: string | null;
  icon?: IconName;
  disabled?: boolean;
  /** Why it cannot be chosen, said beside it. */
  note?: string | null;
  onPress: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      accessibilityLabel={[title, subtitle, note].filter(Boolean).join(", ")}
      style={[styles.choice, selected && styles.choiceOn, disabled && styles.choiceOff]}
    >
      <View style={styles.row}>
        {photo !== undefined ? (
          <Avatar name={title} uri={photo} size="sm" />
        ) : icon ? (
          <View style={styles.icon}>
            <Icon name={icon} color={colors.jade} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Text variant="bodyBold">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="subtle">
              {subtitle}
            </Text>
          ) : null}
          {note ? (
            <Text variant="caption" tone="danger">
              {note}
            </Text>
          ) : null}
        </View>
        <Icon name={selected ? "radio-button-on" : "radio-button-off"} color={selected ? colors.jade : colors.faint} />
      </View>
    </Touchable>
  );
}

/** How far along, as a bar and in words — "Step 3 of 6". */
export function Progress({ index, total, label }: { index: number; total: number; label: string }) {
  const { lang } = useLocale();
  const words = lang === "ar" ? `خطوة ${num(index + 1, lang)} من ${num(total, lang)}` : `Step ${index + 1} of ${total}`;
  return (
    <View style={styles.progress} accessibilityLabel={`${words}: ${label}`} accessible>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>
      <Text variant="caption" tone="subtle">
        {words} · {label}
      </Text>
    </View>
  );
}

/** A label and its value, on one line. */
export function Row({
  label,
  value,
  strong,
  tone,
  ltrValue,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "ok" | "muted";
  /** A reference or a phone: left to right whatever the language. */
  ltrValue?: boolean;
}) {
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="body" tone="subtle" style={styles.lineLabel}>
        {label}
      </Text>
      <Text
        variant={strong ? "bodyBold" : "body"}
        tone={tone === "ok" ? "ok" : tone === "muted" ? "muted" : "ink"}
        style={[styles.lineValue, ltrValue ? ltr : null]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Party size: minus, the number, plus. */
export function Counter({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const { lang } = useLocale();
  return (
    <View style={styles.counter}>
      <Text variant="bodyBold" style={styles.flex}>
        {label}
      </Text>
      <IconButton
        icon="remove"
        label={lang === "ar" ? "أقل" : "Fewer"}
        variant="filled"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <Text variant="heading" style={styles.count} accessibilityLiveRegion="polite">
        {num(value, lang)}
      </Text>
      <IconButton
        icon="add"
        label={lang === "ar" ? "أكتر" : "More"}
        variant="filled"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}

/** A given rating, read as "4 out of 5". */
export function Stars({ value }: { value: number }) {
  const { t } = useLocale();
  return (
    <Text variant="label" style={{ color: colors.star }} accessibilityLabel={t("ratingOf").replace("{n}", String(value))}>
      {"★".repeat(value) + "☆".repeat(Math.max(0, 5 - value))}
    </Text>
  );
}

/** A note set apart — a warning, a policy, a hint. */
export function Notice({ icon, tone = "info", children }: { icon: IconName; tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const fg = tone === "danger" ? colors.danger : tone === "warn" ? colors.warn : tone === "ok" ? colors.ok : colors.info;
  return (
    <View style={[styles.notice, { borderColor: fg }]} accessibilityRole="text">
      <Icon name={icon} color={fg} />
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  choice: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceOn: { borderColor: colors.jade, backgroundColor: colors.jadeTint },
  choiceOff: { opacity: 0.55 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.jadeSoft, alignItems: "center", justifyContent: "center" },
  progress: { gap: spacing.xs },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.surface3, overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.jade },
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.xs },
  lineLabel: { flexShrink: 0, minWidth: 96 },
  lineValue: { flex: 1, textAlign: "auto" },
  counter: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  count: { minWidth: 32, textAlign: "center" },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStartWidth: 4,
    backgroundColor: colors.surface,
  },
});
