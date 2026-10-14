import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Icon, Text, TopBar, colors, ltr, spacing, useLocale } from "@/design";
import { useBusinessAccess } from "@/features/business/access";
import { CONTACT_URL, SUPPORT_EMAIL, SUPPORT_MAILTO, openExternal } from "@/constants/support";

/**
 * Deleting the account, from the business side.
 *
 * An owner's account cannot be deleted in the app: the server refuses
 * ("owns-business", lib/account/deletion.ts), because the business —
 * its bookings, payouts and customers' records — has to be closed
 * first, and that is done by a person at support. So this says so and
 * gives the address to write to. A staff member's account is their own
 * and goes through the same deletion as any customer (/me/delete).
 */
export default function DeleteBusinessAccountScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const access = useBusinessAccess();
  const owner = access.role === "OWNER";

  return (
    <View style={styles.page}>
      <TopBar title={T("حذف الحساب", "Delete account")} back />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {owner ? (
          <Card>
            <View style={styles.titleRow}>
              <Icon name="information-circle-outline" color={colors.night} />
              <Text variant="label" tone="ink2" accessibilityRole="header" style={styles.flex}>
                {T("الحساب ده صاحب نشاط", "This account owns a business")}
              </Text>
            </View>
            <Text variant="body" tone="ink2">
              {T(
                "قبل ما نحذف الحساب لازم نقفل النشاط الأول: الحجوزات الجاية، المدفوعات، وسجلات العملاء. ده بيتعمل مع فريق الدعم عشان محدش يتأذّى.",
                "Before the account can be deleted the business has to be closed: upcoming bookings, payments and customers' records. Support does this with you so no one is left with a booking that won't happen.",
              )}
            </Text>
            <Text variant="body" tone="ink2" style={styles.gap}>
              {T(
                "ابعتلنا من الإيميل أو رقم الموبايل المسجل على الحساب، واكتب اسم النشاط، وهنرد خلال ٢٤ ساعة.",
                "Write to us from the email or phone number on the account, with the business's name, and we'll reply within 24 hours.",
              )}
            </Text>
            <Text variant="caption" tone="subtle" style={styles.gap}>
              {T("إيميل الدعم", "Support email")}
            </Text>
            <Text variant="bodyBold" selectable style={ltr} accessibilityRole="text">
              {SUPPORT_EMAIL}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text variant="body" tone="ink2">
              {T(
                "حسابك كعضو في الفريق هو حسابك الشخصي. لو حذفته هتخرج من النشاط، والحجوزات اللي عملتها هتفضل عند الأنشطة.",
                "As a team member, this is your personal account. Deleting it removes you from the business; bookings stay with the businesses.",
              )}
            </Text>
          </Card>
        )}

        {owner ? (
          <>
            <Button
              label={T("ابعت إيميل للدعم", "Email support")}
              icon="mail-outline"
              fullWidth
              onPress={() => void Linking.openURL(SUPPORT_MAILTO).catch(() => openExternal(CONTACT_URL))}
            />
            <Button label={T("صفحة التواصل", "Contact page")} variant="outline" fullWidth onPress={() => openExternal(CONTACT_URL)} />
          </>
        ) : (
          <Button label={T("كمّل لحذف الحساب", "Continue to delete account")} variant="danger" fullWidth onPress={() => router.push("/me/delete")} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  body: { padding: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1 },
  gap: { marginTop: spacing.md },
});
