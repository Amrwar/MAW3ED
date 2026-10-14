import { useState, type ReactNode } from "react";
import { router, type Href } from "expo-router";
import { Platform, Switch, StyleSheet, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  Icon,
  ListState,
  Screen,
  Text,
  Touchable,
  colors,
  ltr,
  spacing,
  useLocale,
  type IconName,
} from "@/design";
import { useProfile, useUpdateProfile } from "@/features/customer/queries";
import { useNotifications } from "@/features/notifications/queries";
import { PushToggle } from "@/features/notifications/PushToggle";
import { useAuth } from "@/features/auth/AuthProvider";
import { VERSION_LABEL } from "@/constants/version";
import { num } from "@/lib/format";
import { SignInGate } from "@/features/auth/SignInGate";
import { RoleSwitcher } from "@/features/auth/RoleSwitcher";
import { DesignSystemLink } from "@/features/dev/DesignSystemLink";

/**
 * Account.
 *
 * Who you are, how you want to be reached, and the way out — then the
 * places that each need a screen of their own: your reviews, payments,
 * signed-in devices, and deleting the account. Switches save as they are
 * flipped; a Save button for two switches only exists to be forgotten.
 */
export default function AccountScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <SignInGate
      title={ar ? "حسابي" : "Account"}
      reason={ar ? "عشان تدير بياناتك وإشعاراتك." : "To manage your details and notifications."}
    >
      <Account />
    </SignInGate>
  );
}

function Account() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const profile = useProfile();
  const update = useUpdateProfile();
  const notifications = useNotifications();
  const [signingOut, setSigningOut] = useState(false);

  const data = profile.data;
  const unread = notifications.data?.unread ?? 0;

  return (
    <Screen
      hero={
        <>
          <Text
            variant="display"
            tone="inverse"
            accessibilityRole="header"
            style={styles.heroTitle}
          >
            {T("حسابي", "Account")}
          </Text>
          <Touchable
            onPress={() => router.push("/me/profile")}
            accessibilityRole="button"
            accessibilityLabel={T("تعديل بياناتك", "Edit your details")}
            style={styles.identity}
            rippleColor={colors.nightLine}
          >
            <View style={styles.avatar}>
              <Text variant="title" style={styles.avatarText}>
                {initials(data?.name ?? user?.name)}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text variant="title" tone="inverse" numberOfLines={1}>
                {data?.name ?? user?.name ?? T("بدون اسم", "No name yet")}
              </Text>
              {data?.email ? (
                <Text variant="caption" tone="inverseMuted" style={ltr} numberOfLines={1}>
                  {data.email}
                </Text>
              ) : null}
              <View style={styles.phoneRow}>
                <Text variant="caption" tone="inverseMuted" style={ltr}>
                  {data?.phone
                    ? `+${data.phone.replace(/^\+/, "")}`
                    : T("مفيش رقم موبايل", "No phone number")}
                </Text>
                {/* Three states, not two: no number is a different problem from an unconfirmed one. */}
                {data?.phone ? (
                  <Badge
                    label={
                      data.phoneVerified
                        ? T("متأكد", "Verified")
                        : T("محتاج تأكيد", "Needs verifying")
                    }
                    tone={data.phoneVerified ? "ok" : "warn"}
                  />
                ) : (
                  <Badge label={T("مطلوب للحجز", "Needed to book")} tone="warn" />
                )}
              </View>
            </View>
            <Icon name="chevron-forward" color={colors.gold} />
          </Touchable>
        </>
      }
    >
      <ListState
        loading={profile.isLoading}
        error={profile.error}
        isEmpty={false}
        emptyTitle=""
        onRetry={() => profile.refetch()}
      >
        <View style={styles.sections}>
          {/* ── Preferences ── */}
          <Card>
            <Text variant="label" tone="ink2" accessibilityRole="header">
              {T("التنبيهات", "Alerts")}
            </Text>
            <PushToggle compact />
            <SwitchRow
              label={T("واتساب", "WhatsApp")}
              hint={T(
                "تأكيد الحجز والتذكير قبل الميعاد.",
                "Booking confirmations and a reminder before your appointment.",
              )}
              value={data?.notifyByWhatsApp ?? false}
              disabled={!data || update.isPending}
              onChange={(v) => update.mutate({ notifyByWhatsApp: v })}
            />
            <SwitchRow
              label={T("إيميل", "Email")}
              hint={
                data?.email
                  ? T(
                      "نسخة من تفاصيل الحجز على إيميلك.",
                      "A copy of your booking details by email.",
                    )
                  : T("ضيف إيميل عشان تستقبل عليه.", "Add an email to receive these.")
              }
              // Shown off when there is no address: "on" for an email that cannot be sent is a lie.
              value={Boolean(data?.email) && (data?.notifyByEmail ?? false)}
              // An account with no email cannot be emailed.
              disabled={!data?.email || update.isPending}
              onChange={(v) => update.mutate({ notifyByEmail: v })}
            />
            {update.isError ? (
              <Text variant="caption" tone="danger">
                {T("ما اتحفظش. جرّب تاني.", "Not saved. Try again.")}
              </Text>
            ) : null}
            <View style={styles.divider} />
            <Text variant="label" tone="ink2" accessibilityRole="header">
              {T("اللغة", "Language")}
            </Text>
            <View style={styles.langRow}>
              <Button
                size="sm"
                variant={ar ? "primary" : "outline"}
                label="العربية"
                onPress={() => setLang("ar")}
              />
              <Button
                size="sm"
                variant={!ar ? "primary" : "outline"}
                label="English"
                onPress={() => setLang("en")}
              />
            </View>
          </Card>

          {/* ── Everything else, one screen each ── */}
          <Card padded={false}>
            <LinkRow
              icon="notifications-outline"
              label={T("الإشعارات", "Notifications")}
              trailing={
                unread > 0 ? (
                  <Badge label={T(`${num(unread, lang)} جديد`, `${unread} new`)} tone="jade" />
                ) : null
              }
              href="/(customer)/notifications"
            />
            <LinkRow icon="star-outline" label={T("تقييماتي", "My reviews")} href="/me/reviews" />
            <LinkRow
              icon="receipt-outline"
              label={T("المدفوعات", "Payments")}
              href="/me/payments"
            />
            <LinkRow
              icon="shield-checkmark-outline"
              label={T("الأمان والأجهزة", "Security & devices")}
              href="/me/security"
              last
            />
          </Card>

          <RoleSwitcher current="customer" />

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

          <Button
            label={T("حذف الحساب", "Delete account")}
            variant="ghost"
            onPress={() => router.push("/me/delete")}
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

/** Up to two letters from the name, for the avatar; a person icon's stand-in when there is none. */
function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function SwitchRow({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      </View>
      {/* react-native-web draws the thumb off its track in right-to-left; native mirrors a switch itself. */}
      <View style={Platform.OS === "web" ? ltr : undefined}>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.night, false: colors.line2 }}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  href,
  trailing,
  last,
}: {
  icon: IconName;
  label: string;
  href: Href;
  trailing?: ReactNode;
  last?: boolean;
}) {
  return (
    <Touchable
      onPress={() => router.push(href)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={[styles.link, !last && styles.linkLine]}
    >
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
  sections: { gap: spacing.lg },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
    overflow: "hidden",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.night },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  heroTitle: { marginBottom: spacing.md },
  phoneRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  switchRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  langRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  linkLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  version: { textAlign: "center", marginTop: spacing.sm },
});
