import { Image, View, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { money, rating } from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

export interface BusinessCardData {
  slug: string;
  nameAr: string;
  logoImage: string | null;
  coverImage: string | null;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  category: { nameAr: string };
  city: { nameAr: string };
  minPrice?: number | null;
  currency?: string;
  open?: { isOpen: boolean } | null;
}

/**
 * One business in a list.
 *
 * What it does NOT do is as deliberate as what it does. A business
 * nobody has reviewed shows no rating rather than "0.0 ★", and one with
 * no priced service shows no price rather than "0 ج.م" — both read as
 * a judgement on the business instead of an absence of data, and the
 * web had to have both removed after they shipped.
 */
export function BusinessCard({
  business,
  onPress,
  trailing,
}: {
  business: BusinessCardData;
  onPress?: () => void;
  /** A remove button on the saved list, say. */
  trailing?: React.ReactNode;
}) {
  const score = rating(business.ratingAvg, business.ratingCount);
  const price = money(business.minPrice ?? null, business.currency ?? "EGP");
  const image = business.logoImage ?? business.coverImage;

  return (
    <Card onPress={onPress} accessibilityLabel={business.nameAr}>
      <View style={styles.row}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.thumb}
            // The name is beside it; announcing the logo twice adds
            // nothing for a screen reader.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text variant="heading" tone="jade">
              {business.nameAr.trim().charAt(0)}
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="bodyBold" numberOfLines={1} style={styles.name}>
              {business.nameAr}
            </Text>
            {business.isVerified ? <Badge label="موثّق" tone="jade" /> : null}
          </View>

          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {business.category.nameAr} · {business.city.nameAr}
          </Text>

          <View style={styles.metaRow}>
            {/* Each of these is omitted rather than zeroed when absent. */}
            {score ? (
              <Text variant="caption" tone="muted">
                ★ {score}
              </Text>
            ) : null}
            {price ? (
              <Text variant="caption" tone="muted">
                من {price}
              </Text>
            ) : null}
            {business.open ? (
              <Badge
                label={business.open.isOpen ? "مفتوح" : "مقفول"}
                tone={business.open.isOpen ? "ok" : "neutral"}
              />
            ) : null}
          </View>
        </View>

        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
  },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flexShrink: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  trailing: { marginStart: spacing.sm },
});
