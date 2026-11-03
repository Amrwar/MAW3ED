import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Text, TopBar, colors, spacing, useLocale } from "@/design";
import { CONTACT_URL, PRIVACY_URL, SITE_URL, SUPPORT_EMAIL, SUPPORT_MAILTO, openExternal } from "@/constants/support";

/**
 * Help, for customers: the answers that already exist on the website, and
 * a person when they are not enough. Problems with one booking are the
 * business's to fix, so that comes first — the booking screen has the
 * business's phone and WhatsApp.
 */
export default function SupportScreen() {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const insets = useSafeAreaInsets();
  const site = (path: string) => `${SITE_URL}${lang === "en" ? "/en" : ""}${path}`;
  return (
    <View style={styles.page}>
      <TopBar title={T("المساعدة والدعم", "Help and support")} back backTo="/(customer)/account" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card>
          <Text variant="label" accessibilityRole="header">{T("مشكلة في حجز؟", "A problem with a booking?")}</Text>
          <Text variant="body" tone="ink2">
            {T(
              "المكان هو اللي يقدر يغيّر أو يلغي حجزك. افتح الحجز من «حجوزاتي» — هتلاقي رقمه وواتساب، والإلغاء وتغيير الميعاد لو مسموحين.",
              "The business can change or cancel your booking. Open it from My bookings — you'll find their phone and WhatsApp, and cancelling or rescheduling where allowed.",
            )}
          </Text>
        </Card>
        <Card>
          <Text variant="label" accessibilityRole="header">{T("إجابات سريعة", "Quick answers")}</Text>
          <View style={styles.stack}>
            <Button label={T("مركز المساعدة", "Help centre")} icon="help-circle-outline" variant="outline" fullWidth onPress={() => openExternal(site("/help"))} />
            <Button label={T("الأسئلة الشائعة", "Frequently asked questions")} icon="chatbubbles-outline" variant="outline" fullWidth onPress={() => openExternal(site("/faq"))} />
          </View>
        </Card>
        <Card>
          <Text variant="label" accessibilityRole="header">{T("كلّم فريق موعد", "Talk to the Maw3ed team")}</Text>
          <Text variant="caption" tone="muted">{T("بنرد خلال يوم عمل.", "We reply within one working day.")}</Text>
          <View style={styles.stack}>
            <Button
              label={T("ابعت إيميل", "Send an email")}
              icon="mail-outline"
              fullWidth
              onPress={() => void Linking.openURL(SUPPORT_MAILTO).catch(() => openExternal(CONTACT_URL))}
            />
            <Text variant="caption" align="center" tone="muted">{SUPPORT_EMAIL}</Text>
            <Button label={T("صفحة التواصل", "Contact page")} icon="open-outline" variant="outline" fullWidth onPress={() => openExternal(CONTACT_URL)} />
          </View>
        </Card>
        <Card>
          <Text variant="label" accessibilityRole="header">{T("الشروط والخصوصية", "Terms and privacy")}</Text>
          <View style={styles.stack}>
            <Button label={T("سياسة الخصوصية", "Privacy policy")} icon="shield-checkmark-outline" variant="ghost" fullWidth onPress={() => openExternal(PRIVACY_URL)} />
            <Button label={T("شروط الاستخدام", "Terms of use")} icon="document-text-outline" variant="ghost" fullWidth onPress={() => openExternal(site("/terms"))} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface2 },
  body: { padding: spacing.lg, gap: spacing.lg },
  stack: { gap: spacing.sm },
});
