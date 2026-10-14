import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Button, Card, ErrorState, Icon, SkeletonCard, Text, TopBar, colors, ltr, spacing, useLocale, type IconName } from "@/design";
import { pick } from "@/features/business/components";
import { useBusinessProfile } from "@/features/business/queries";
import { config } from "@/lib/config";
import { formatPhone, num, time } from "@/lib/format";

/**
 * The business as the team sees it: what customers see on the public
 * page, contact details, hours and branches — to check, and to open the
 * public page. Editing is on the web dashboard.
 */

const DAY_NAMES = {
  ar: ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
} as const;

export default function BusinessProfileScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const profile = useBusinessProfile();
  const p = profile.data;

  if (!p) {
    return (
      <View style={styles.page}>
        <TopBar title={T("صفحة النشاط", "Business profile")} back backTo="/(business)/account" />
        <View style={styles.body}>{profile.isLoading ? <SkeletonCard /> : <ErrorState error={profile.error} onRetry={() => profile.refetch()} />}</View>
      </View>
    );
  }

  // The API and the website are one origin (maw3ed.net).
  const site = config.apiUrl;
  const publicUrl = `${site}/company/${p.slug}`;
  const facts = [
    p.category ? { icon: "grid-outline" as IconName, text: pick(lang, p.category.nameAr, p.category.nameEn) } : null,
    p.city ? { icon: "business-outline" as IconName, text: pick(lang, p.city.nameAr, p.city.nameEn) } : null,
    p.address ? { icon: "location-outline" as IconName, text: p.address } : null,
    p.phone ? { icon: "call-outline" as IconName, text: formatPhone(p.phone), ltr: true } : null,
    p.whatsapp ? { icon: "logo-whatsapp" as IconName, text: formatPhone(p.whatsapp), ltr: true } : null,
  ].filter(Boolean) as { icon: IconName; text: string; ltr?: boolean }[];

  return (
    <View style={styles.page}>
      <TopBar title={pick(lang, p.nameAr, p.nameEn)} subtitle={T("صفحة النشاط", "Business profile")} back backTo="/(business)/account">
        <View style={styles.badges}>
          <Badge label={p.isPublished ? T("منشورة", "Published") : T("مش منشورة", "Not published")} tone={p.isPublished ? "ok" : "warn"} />
          <Badge label={p.autoConfirm ? T("تأكيد تلقائي", "Auto-confirm") : T("تأكيد يدوي", "Manual confirm")} tone="neutral" />
          {p.ratingCount > 0 ? <Badge label={`★ ${p.ratingAvg?.toFixed(1)} (${num(p.ratingCount, lang)})`} tone="neutral" /> : null}
        </View>
      </TopBar>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card>
          {facts.map((f) => (
            <View key={f.icon} style={styles.fact}>
              <Icon name={f.icon} size="sm" color={colors.night} />
              <Text variant="body" style={[styles.flex, f.ltr ? ltr : null]}>
                {f.text}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text variant="label" tone="ink2" accessibilityRole="header">
            {T("مواعيد الشغل", "Opening hours")}
          </Text>
          {p.availability.length === 0 ? (
            <Text variant="caption" tone="subtle">
              {T("مفيش مواعيد متحددة.", "No hours set.")}
            </Text>
          ) : (
            p.availability.map((d) => (
              <View key={d.dayOfWeek} style={styles.hours}>
                <Text variant="body">{DAY_NAMES[lang][d.dayOfWeek]}</Text>
                <Text variant="body" tone={d.isClosed ? "subtle" : "ink"}>
                  {d.isClosed ? T("مقفول", "Closed") : `${time(d.openTime, lang)} – ${time(d.closeTime, lang)}`}
                </Text>
              </View>
            ))
          )}
        </Card>

        {p.branches.length > 0 ? (
          <Card>
            <Text variant="label" tone="ink2" accessibilityRole="header">
              {T("الفروع", "Branches")}
            </Text>
            {p.branches.map((b) => (
              <View key={b.id} style={styles.branch}>
                <Text variant="bodyBold">{pick(lang, b.nameAr, b.nameEn)}</Text>
                {b.address ? (
                  <Text variant="caption" tone="subtle">
                    {b.address}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        <Button variant="outline" icon="open-outline" label={T("افتح الصفحة العامة", "Open the public page")} onPress={() => void Linking.openURL(publicUrl)} />
        <Text variant="caption" tone="subtle" align="center">
          {T("التعديل من لوحة التحكم على الموقع.", "Edit on the web dashboard.")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 32 },
  hours: { flexDirection: "row", justifyContent: "space-between", minHeight: 30, alignItems: "center" },
  branch: { paddingVertical: spacing.xs, gap: 2 },
});
