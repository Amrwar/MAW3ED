import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Badge, Button, Card, Icon, Screen, Text, Touchable, colors, spacing, useLocale, type IconName } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { useBusinessAccess } from "@/features/business/access";
import { roleLabel } from "@/features/business/components";
import { useOverview } from "@/features/business/queries";
import { DesignSystemLink } from "@/features/dev/DesignSystemLink";
import { PushToggle } from "@/features/notifications/PushToggle";
import { VERSION_LABEL } from "@/constants/version";
import { num } from "@/lib/format";

/**
 * More: everything that is not the day itself.
 *
 * The business (its profile, team and services — to look at; editing is
 * on the web dashboard), the numbers for the owner, notifications, and
 * this person's own settings and the way out. Each link shows only when
 * this person may open what it leads to.
 */
export default function More() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const access = useBusinessAccess();
  const overview = useOverview();
  const [signingOut, setSigningOut] = useState(false);
  const o = overview.data;
  const business = o ? (lang === "en" && o.business.nameEn) || o.business.nameAr : (user?.staff?.businessName ?? "");
  const unread = o?.counts.unreadNotifications ?? 0;

  return (
    <Screen
      hero={
        <View style={styles.hero}>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            {T("المزيد", "More")}
          </Text>
          <Text variant="body" tone="inverseMuted" numberOfLines={1}>
            {[user?.name, business].filter(Boolean).join(" · ")}
          </Text>
          <View>
            <Badge label={roleLabel(access.role, lang)} tone="neutral" />
          </View>
        </View>
      }
    >
      <View style={styles.sections}>
        <Card padded={false}>
          <Link icon="storefront-outline" label={T("صفحة النشاط", "Business profile")} href="/manage/profile" />
          {access.can("staff.read") ? <Link icon="people-outline" label={T("الفريق", "Staff")} href="/manage/staff" /> : null}
          {access.can("services.read") ? <Link icon="pricetags-outline" label={T("الخدمات", "Services")} href="/manage/services" /> : null}
          {access.can("reports.read") ? <Link icon="stats-chart-outline" label={T("التقارير", "Reports")} href="/manage/reports" /> : null}
          <Link
            icon="notifications-outline"
            label={T("الإشعارات", "Notifications")}
            href="/(business)/notifications"
            trailing={unread > 0 ? <Badge label={T(`${num(unread, lang)} جديد`, `${unread} new`)} tone="jade" /> : null}
            last
          />
        </Card>

        <Card>
          <Text variant="label" tone="ink2" accessibilityRole="header">
            {T("التنبيهات", "Alerts")}
          </Text>
          <PushToggle compact />
          <View style={styles.divider} />
          <Text variant="label" tone="ink2" accessibilityRole="header">
            {T("اللغة", "Language")}
          </Text>
          <View style={styles.langRow}>
            <Button size="sm" variant={ar ? "primary" : "outline"} label="العربية" onPress={() => setLang("ar")} />
            <Button size="sm" variant={!ar ? "primary" : "outline"} label="English" onPress={() => setLang("en")} />
          </View>
        </Card>

        {access.role === "OWNER" ? (
          <Text variant="caption" tone="subtle">
            {T(
              "تعديل الخدمات والفريق والإعدادات والفلوس من لوحة التحكم على الموقع.",
              "Services, staff, settings and payments are edited on the web dashboard.",
            )}
          </Text>
        ) : null}

        {/* The same account can book like any customer, or administer. */}
        <RoleSwitcher current="business" />

        <Button
          label={T("تسجيل الخروج", "Sign out")}
          variant="outline"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            try {
              await signOut();
            } finally {
              setSigningOut(false);
            }
          }}
        />

        <DesignSystemLink />
        <Text variant="caption" tone="subtle" style={styles.version}>
          {VERSION_LABEL}
        </Text>
      </View>
    </Screen>
  );
}

function Link({ icon, label, href, trailing, last }: { icon: IconName; label: string; href: Href; trailing?: ReactNode; last?: boolean }) {
  return (
    <Touchable onPress={() => router.push(href)} accessibilityRole="link" accessibilityLabel={label} style={[styles.link, !last && styles.linkLine]}>
      <View style={styles.linkIcon}>
        <Icon name={icon} color={colors.night} size="sm" />
      </View>
      <Text variant="body" style={styles.flex}>
        {label}
      </Text>
      {trailing}
      <Icon name="chevron-forward" color={colors.faint} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.xs },
  sections: { gap: spacing.lg },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 },
  linkLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  linkIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  langRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  version: { textAlign: "center", marginTop: spacing.sm },
});
