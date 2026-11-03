import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonCard, Text, TopBar, colors, radius, spacing, useLocale } from "@/design";
import { useGuestPass } from "@/features/access/queries";
import { PASS_STATE, showsCode } from "@/features/access/logic";
import { ApiError } from "@/lib/api/errors";

/**
 * A guest's own visitor pass, from the link the booking's holder sent them
 * (www.maw3ed.net/pass/<token>). Only that guest's pass and the venue's
 * instructions — nothing about the booking, the business or anyone else.
 * The code shows only once the venue's access system confirmed the pass.
 */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export default function GuestPassScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const valid = typeof token === "string" && TOKEN.test(token);
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const q = useGuestPass(valid ? token : undefined, lang);
  const insets = useSafeAreaInsets();

  if (!valid || (q.error instanceof ApiError && q.error.status === 404)) {
    return (
      <View style={styles.page}>
        <TopBar title={T("تصريح زيارة", "Visitor pass")} back backTo="/" />
        <EmptyState icon="shield-outline" title={T("الرابط ده مش شغّال", "This link doesn't work")} body={T("ممكن يكون اتلغى. اسأل اللي بعته لك.", "It may have been cancelled. Ask whoever sent it.")} action={<Button label={T("الرئيسية", "Home")} onPress={() => router.replace("/")} />} />
      </View>
    );
  }
  if (q.isLoading) {
    return (
      <View style={styles.page}>
        <TopBar title={T("تصريح زيارة", "Visitor pass")} back backTo="/" />
        <View style={styles.body}><SkeletonCard /></View>
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={styles.page}>
        <TopBar title={T("تصريح زيارة", "Visitor pass")} back backTo="/" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </View>
    );
  }
  const { pass, venue, sandbox } = q.data;
  const s = PASS_STATE[pass.state];
  const when = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: "Africa/Cairo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : null;

  return (
    <View style={styles.page}>
      <TopBar title={T("تصريح زيارة", "Visitor pass")} subtitle={venue?.name} back backTo="/" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.jade} />}
      >
        <Card>
          <View style={styles.between}>
            <Text variant="heading" accessibilityRole="header">{pass.displayName}</Text>
            <Badge tone={s.tone} label={lang === "ar" ? s.label[0] : s.label[1]} />
          </View>
          {sandbox ? <Badge tone="warn" icon="flask-outline" label={T("تجريبي — مش شغّال على أي بوابة حقيقية", "Test pass — not valid at any real gate")} /> : null}
          {pass.reason && pass.state !== "active" ? <Text variant="caption" tone="muted">{pass.reason}</Text> : null}
          {showsCode(pass) ? (
            <>
              <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel={T("كود التصريح — اعرضه على البوابة", "Pass code — show it at the gate")}>
                <SvgXml xml={pass.qrSvg!} width="100%" height="100%" />
              </View>
              {pass.validFrom && pass.validUntil ? <Text variant="caption" align="center">{`${when(pass.validFrom)} – ${when(pass.validUntil)}`}</Text> : null}
              {pass.gates.length ? <Text variant="tiny" tone="muted" align="center">{T("البوابات: ", "Gates: ")}{pass.gates.join(T("، ", ", "))}</Text> : null}
            </>
          ) : (
            <Text variant="caption" tone="muted">
              {pass.state === "pending"
                ? T("الكود هيظهر هنا أول ما نظام دخول المكان يوافق.", "The code appears here once the venue's access system confirms it.")
                : T("مفيش كود دخول دلوقتي.", "There is no entry code right now.")}
            </Text>
          )}
          {venue?.instructions ? <Text variant="caption" tone="ink2">{venue.instructions}</Text> : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface2 },
  body: { padding: spacing.lg, gap: spacing.lg },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  qr: { alignSelf: "center", width: 260, height: 260, maxWidth: "100%", padding: spacing.sm, backgroundColor: colors.qrPaper, borderRadius: radius.sm },
});
