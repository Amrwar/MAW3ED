import { Image, StyleSheet, View } from "react-native";
import { Icon, Text, Touchable, colors, radius, spacing, useLocale } from "@/design";
import { sized } from "@/lib/image";
import { count } from "@/lib/plural";
import type { BusinessCardData } from "@/features/discovery/BusinessCard";
import type { OrgDirectoryEntry, VenueDirectoryEntry } from "@/types/places";

/** One organization or venue in a list: its logo, name, city and how many businesses it lists. */
export function PlaceRow({
  name, city, logo, businesses, kindLabel, onPress, testID,
}: {
  name: string;
  city: string | null;
  logo: string | null;
  businesses: number;
  kindLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const { lang } = useLocale();
  const listed = count(businesses, "place", lang);
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const sep = T("، ", ", ");
  return (
    <Touchable onPress={onPress} style={styles.row} accessibilityRole="link" accessibilityLabel={[name, kindLabel, listed].join(sep)} testID={testID}>
      {logo ? (
        <Image source={{ uri: sized(logo, 96) }} style={styles.logo} accessibilityElementsHidden importantForAccessibility="no" />
      ) : (
        <View style={[styles.logo, styles.logoEmpty]}>
          <Icon name="business-outline" size={22} color={colors.jade} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="bodyBold" numberOfLines={1}>{name}</Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[kindLabel, city].filter(Boolean).join(" · ")}
        </Text>
        <Text variant="tiny" tone="jade">{listed}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.subtle} />
    </Touchable>
  );
}

/** A directory entry drawn as the app's business card. */
export function entryCard(e: OrgDirectoryEntry | VenueDirectoryEntry, fallbackCity: { nameAr: string; nameEn: string } | null): BusinessCardData {
  return {
    slug: e.slug,
    nameAr: e.nameAr,
    nameEn: e.nameEn,
    logoImage: e.logoImage,
    coverImage: null,
    isVerified: e.isVerified,
    ratingAvg: e.ratingAvg || null,
    ratingCount: e.ratingCount,
    category: { nameAr: e.category?.nameAr ?? "", nameEn: e.category?.nameEn },
    city: ("city" in e && e.city) || fallbackCity || { nameAr: "", nameEn: "" },
  };
}

/** What kind of place it is, in the reader's language. */
export function kindLabel(kind: string, lang: "ar" | "en"): string {
  const k: Record<string, [string, string]> = {
    MALL: ["مول", "Mall"],
    COMPOUND: ["كمبوند", "Compound"],
    BUSINESS_GROUP: ["مجموعة أنشطة", "Business group"],
    RESTAURANT_GROUP: ["مجموعة مطاعم", "Restaurant group"],
    CLINIC_GROUP: ["مجموعة عيادات", "Clinic group"],
    FRANCHISE: ["فرانشايز", "Franchise"],
    COMMERCIAL_BUILDING: ["مبنى تجاري", "Commercial building"],
    OFFICE_COMPLEX: ["مجمع مكاتب", "Office complex"],
    BUSINESS_PARK: ["بيزنس بارك", "Business park"],
    MIXED_USE: ["مجمع متعدد الاستخدام", "Mixed-use"],
    COMMUNITY_CENTER: ["مركز خدمات", "Community centre"],
  };
  const v = k[kind] ?? ["مكان", "Place"];
  return lang === "ar" ? v[0] : v[1];
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  logo: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface2 },
  logoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.jadeSoft },
  text: { flex: 1, gap: 2 },
});
