import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAnalytics } from "@/hooks/useBusinessData";
import { useAuth } from "@/stores/auth";
import { VERSION_LABEL } from "@/constants/version";
import { money, num } from "@/lib/format";
import { spacing } from "@/constants/theme";

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
  const { user, roles, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const { monthStart, today } = useMemo(() => {
    const now = cairoToday();
    return { monthStart: `${now.slice(0, 7)}-01`, today: now };
  }, []);

  const analytics = useAnalytics(monthStart, today);
  const kpis = analytics.data?.kpis;

  return (
    <Screen>
      <Text variant="title">حسابي</Text>

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

        {/* Only for accounts that are actually both. */}
        {roles.includes("customer") && roles.includes("business") ? (
          <Card>
            <Text variant="bodyBold">حجوزاتك الشخصية</Text>
            <Text variant="caption" tone="muted" style={styles.row}>
              نفس الحساب بيقدر يحجز زي أي عميل.
            </Text>
          </Card>
        ) : null}

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
