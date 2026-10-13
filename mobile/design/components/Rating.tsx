import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../tokens";
import { useLocale } from "../locale";
import { fill, joinLabel } from "../strings";
import { num } from "@/lib/format";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { Touchable } from "./Touchable";

/**
 * A business's rating: "★ 4.2 (37)". With no reviews it says "New" —
 * never "0.0", which reads as a terrible business rather than a new one.
 * Announced as one phrase ("4.2 out of 5, 37 reviews").
 */
export function Rating({ value, count, size = "md" }: { value: number | null; count: number; size?: "sm" | "md" }) {
  const { lang, t } = useLocale();
  const small = size === "sm";

  if (value === null || count === 0) {
    return (
      <Text variant={small ? "tiny" : "label"} tone="jade">
        {t("noReviews")}
      </Text>
    );
  }

  const label = joinLabel(lang, fill(t("ratingOf"), { n: value.toFixed(1) }), fill(t("reviews"), { n: num(count, lang) }));
  return (
    <View style={styles.row} accessible role="img" aria-label={label}>
      <Icon name="star" size={small ? 13 : 16} color={colors.star} />
      <Text variant={small ? "tiny" : "label"}>{value.toFixed(1)}</Text>
      <Text variant={small ? "tiny" : "caption"} tone="subtle">
        ({num(count, lang)})
      </Text>
    </View>
  );
}

/**
 * Choosing a rating — five stars, each a radio button with its number,
 * so a screen reader can pick "4 out of 5" directly. Stars run in
 * reading order, so in Arabic one star is on the right.
 */
export function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useLocale();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Touchable
          key={n}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={fill(t("ratingOf"), { n })}
          onPress={() => onChange(n)}
          style={styles.star}
          borderless
        >
          <Icon name={n <= value ? "star" : "star-outline"} size={30} color={n <= value ? colors.star : colors.line2} />
        </Touchable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  star: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});
