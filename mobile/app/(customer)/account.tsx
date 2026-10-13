import { useState } from "react";
import { router } from "expo-router";
import { Switch, View, StyleSheet } from "react-native";
import { Screen, Text, Button, Card, Badge, ListState, colors, spacing } from "@/design";
import { useProfile, useUpdateProfile } from "@/features/customer/queries";
import { useNotifications } from "@/features/notifications/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { VERSION_LABEL } from "@/constants/version";
import { num } from "@/lib/format";
import { SignInGate } from "@/features/auth/SignInGate";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { DesignSystemLink } from "@/features/dev/DesignSystemLink";

/**
 * Account.
 *
 * Who you are, how you want to be reached, and the way out. The
 * notification toggles save as you flip them — a Save button for two
 * switches is a step that exists only to be forgotten.
 */
export default function AccountScreen() {
  return (
    <SignInGate title="حسابي" reason="عشان تدير بياناتك وإشعاراتك.">
      <Account />
    </SignInGate>
  );
}

function Account() {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const update = useUpdateProfile();
  const notifications = useNotifications();

  const [signingOut, setSigningOut] = useState(false);

  const data = profile.data;

  return (
    <Screen>
      <Text variant="title">حسابي</Text>

      <ListState
        loading={profile.isLoading}
        error={profile.error}
        isEmpty={false}
        emptyTitle=""
        onRetry={() => profile.refetch()}
      >
        <View style={styles.sections}>
          {/* ── Identity ── */}
          <Card>
            <Text variant="bodyBold">{data?.name ?? user?.name ?? "بدون اسم"}</Text>
            {data?.email ? (
              <Text variant="caption" tone="muted" style={styles.row}>
                {data.email}
              </Text>
            ) : null}

            <View style={styles.phoneRow}>
              <Text variant="caption" tone="muted">
                {data?.phone ?? "مفيش رقم موبايل"}
              </Text>
              {/* Three states, not two: no number at all is a different
                  problem from a number nobody confirmed. */}
              {data?.phone ? (
                <Badge
                  label={data.phoneVerified ? "متأكد" : "محتاج تأكيد"}
                  tone={data.phoneVerified ? "ok" : "warn"}
                />
              ) : (
                <Badge label="مطلوب للحجز" tone="warn" />
              )}
            </View>

            {data && !data.phoneVerified ? (
              <Text variant="caption" tone="subtle" style={styles.hint}>
                حجوزاتك بتترّبط برقمك، فلازم يتأكد الأول.
              </Text>
            ) : null}
          </Card>

          {/* ── How we reach you ── */}
          <Card>
            <Text variant="bodyBold">التنبيهات</Text>

            <View style={styles.switchRow}>
              <Text variant="body">واتساب</Text>
              <Switch
                value={data?.notifyByWhatsApp ?? false}
                onValueChange={(value) => update.mutate({ notifyByWhatsApp: value })}
                disabled={!data || update.isPending}
                trackColor={{ true: colors.jade, false: colors.line2 }}
                accessibilityLabel="تنبيهات واتساب"
              />
            </View>

            <View style={styles.switchRow}>
              <Text variant="body">إيميل</Text>
              <Switch
                value={data?.notifyByEmail ?? false}
                onValueChange={(value) => update.mutate({ notifyByEmail: value })}
                // An account with no email cannot be emailed, so the
                // switch is off the table rather than silently useless.
                disabled={!data?.email || update.isPending}
                trackColor={{ true: colors.jade, false: colors.line2 }}
                accessibilityLabel="تنبيهات الإيميل"
              />
            </View>

            {!data?.email ? (
              <Text variant="caption" tone="subtle" style={styles.hint}>
                ضيف إيميل عشان تقدر تستقبل تنبيهات عليه.
              </Text>
            ) : null}

            {update.isError ? (
              <Text variant="caption" tone="danger" style={styles.hint}>
                ما اتحفظش. جرّب تاني.
              </Text>
            ) : null}
          </Card>

          {/* ── Notifications — opens the full list, which has no tab of its own ── */}
          <Card
            onPress={() => router.push("/(customer)/notifications")}
            accessibilityLabel={`الإشعارات${notifications.data?.unread ? `، ${num(notifications.data.unread)} جديد` : ""}`}
          >
            <View style={styles.switchRow}>
              <Text variant="bodyBold">الإشعارات</Text>
              {notifications.data && notifications.data.unread > 0 ? (
                <Badge label={`${num(notifications.data.unread)} جديد`} tone="jade" />
              ) : null}
            </View>
            <Text variant="caption" tone="muted" style={styles.row}>
              {notifications.data?.notifications[0]?.title ?? "مفيش إشعارات."}
            </Text>
          </Card>

          <RoleSwitcher current="customer" />

          <Button
            label="تسجيل الخروج"
            variant="outline"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                // The navigator moves to the login screen on its own
                // once the user is gone; this only matters if it fails.
                setSigningOut(false);
              }
            }}
          />

          {/* Quiet, but the first thing worth knowing in a bug report. */}
          <DesignSystemLink />
          <Text variant="caption" tone="subtle" style={styles.version}>
            {VERSION_LABEL}
          </Text>
        </View>
      </ListState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: spacing.lg, gap: spacing.lg },
  row: { marginTop: spacing.xs },
  phoneRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  hint: { marginTop: spacing.sm },
  switchRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  version: { textAlign: "center", marginTop: spacing.sm },
});
