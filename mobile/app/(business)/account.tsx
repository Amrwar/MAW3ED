import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Screen, Text, Button, Card, spacing } from "@/design";
import { useAnalytics } from "@/features/business/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { VERSION_LABEL } from "@/constants/version";
import { money, num } from "@/lib/format";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { DesignSystemLink } from "@/features/dev/DesignSystemLink";

/**
 * The owner's account.
 *
 * Who is signed in, how the month is going, and the way out. The
 * numbers repeat the dashboard's deliberately — this is the screen
 * somebody opens to answer "how are we doing" without reading a list.
 *
 * Switching space is here rather than in the tab bar: an owner is also
 * a customer, and the two sets of screens are different enough that a
 * sixth tab would be confusing. It appears only for accounts that
 * genuinely have both.
 */
export default function BusinessAccount() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const { monthStart, today } = useMemo(() => {
    const now = cairoToday();
    return { monthStart: `${now.slice(0, 7)}-01`, today: now };
  }, []);

  const analytics = useAnalytics(monthStart, today);
  const kpis = analytics.data?.kpis;

  return (
    <Screen
      hero={
        <Text variant="display" tone="inverse" accessibilityRole="header">
          حسابي
        </Text>
      }
    >

      <View style={styles.sections}>
        <Card>
          <Text variant="bodyBold">{user?.name ?? "صاحب العمل"}</Text>
          {user?.email ? (
            <Text variant="caption" tone="muted" style={styles.row}>
              {user.email}
            </Text>
          ) : null}
        </Card>

        <Card>
          <Text variant="bodyBold">الشهر ده</Text>

          <View style={styles.statRow}>
            <Text variant="body" tone="muted">
              حجوزات
            </Text>
            {/* Em dash while loading. A zero would be an assertion we
                have not earned yet. */}
            <Text variant="bodyBold">
              {analytics.isLoading ? "—" : kpis ? num(kpis.totalBookings) : "—"}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text variant="body" tone="muted">
              إيراد مكتمل
            </Text>
            <Text variant="bodyBold">
              {analytics.isLoading
                ? "—"
                : kpis
                  ? (money(kpis.completedRevenue, kpis.currency) ?? "—")
                  : "—"}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text variant="body" tone="muted">
              متوسط الحجز
            </Text>
            <Text variant="bodyBold">
              {analytics.isLoading
                ? "—"
                : kpis
                  ? (money(kpis.avgBookingValue, kpis.currency) ?? "—")
                  : "—"}
            </Text>
          </View>

          {analytics.isError ? (
            <Text variant="caption" tone="danger" style={styles.row}>
              ما قدرناش نجيب الأرقام دلوقتي.
            </Text>
          ) : null}
        </Card>

        {/* The same account can book like any customer, or administer. */}
        <RoleSwitcher current="business" />

        <Button
          label="تسجيل الخروج"
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

/** Today in Cairo. The server's dates are Cairo dates. */
function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const styles = StyleSheet.create({
  sections: { marginTop: spacing.lg, gap: spacing.lg },
  row: { marginTop: spacing.xs },
  statRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  version: { textAlign: "center", marginTop: spacing.sm },
});
