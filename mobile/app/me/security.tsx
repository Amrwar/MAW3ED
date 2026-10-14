import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Badge, Button, Card, ConfirmDialog, Header, Icon, ListState, Screen, Text, colors, spacing, useLocale, useToast } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { useEndSession, useSessions } from "@/features/account/queries";
import { relativeTime } from "@/lib/format";

/**
 * Where the account is signed in through the app, and the way to end
 * any of it. There is no password to change for a phone account: proving
 * the phone is the password, every time.
 */
export default function SecurityScreen() {
  const { lang } = useLocale();
  return (
    <SignInGate title={lang === "ar" ? "الأمان" : "Security"} reason={lang === "ar" ? "عشان تدير أجهزتك." : "To manage your devices."}>
      <Security />
    </SignInGate>
  );
}

function Security() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const query = useSessions();
  const end = useEndSession();
  const toast = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const sessions = query.data?.sessions ?? [];
  const others = sessions.filter((s) => !s.current);

  // Read once per visit: "used 3 minutes ago" need not tick while open.
  const [now] = useState(() => Date.now());
  const ago = (iso: string) => relativeTime(Math.min(0, Math.round((new Date(iso).getTime() - now) / 60_000)), lang);

  return (
    <Screen scroll={false} edges="both"
      hero={<Header title={T("الأمان والأجهزة", "Security & devices")} back tone="night" />}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.jade} />}
      >
        <Card tone="tint">
          <View style={styles.row}>
            <Icon name="key-outline" color={colors.jade} />
            <Text variant="body" tone="ink2" style={styles.flex}>
              {T(
                "بتدخل بكود بيوصل لموبايلك كل مرة، فمفيش كلمة سر تتسرق. لو حد تاني دخل، اقفل جلسته من هنا.",
                "You sign in with a code sent to your phone each time, so there's no password to steal. If a device shouldn't be signed in, end it here.",
              )}
            </Text>
          </View>
        </Card>

        <Text variant="label" tone="ink2" accessibilityRole="header">
          {T("الأجهزة المتسجلة", "Signed-in devices")}
        </Text>
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={sessions.length === 0}
          emptyTitle={T("مفيش أجهزة", "No devices")}
          onRetry={() => query.refetch()}
        >
          {sessions.map((s) => (
            <Card key={s.id}>
              <View style={styles.row}>
                <Icon name="phone-portrait-outline" color={colors.muted} />
                <View style={styles.flex}>
                  <Text variant="bodyBold">{s.deviceName || T("جهاز", "Device")}</Text>
                  <Text variant="caption" tone="subtle">
                    {T("آخر استخدام", "Last used")} {ago(s.lastUsedAt)}
                  </Text>
                </View>
                {s.current ? (
                  <Badge tone="jade" label={T("الجهاز ده", "This device")} />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    label={T("اقفل", "End")}
                    loading={end.isPending && end.variables !== "others" && end.variables?.sessionId === s.id}
                    onPress={() =>
                      end.mutate(
                        { sessionId: s.id },
                        { onSuccess: () => toast({ message: T("الجلسة اتقفلت", "Session ended"), tone: "ok" }) },
                      )
                    }
                  />
                )}
              </View>
            </Card>
          ))}
        </ListState>

        {others.length > 0 ? (
          <Button variant="danger" label={T("اقفل كل الأجهزة التانية", "Sign out all other devices")} onPress={() => setConfirmAll(true)} />
        ) : null}
        <Text variant="caption" tone="subtle">
          {T("الجهاز اللي بيتقفل بيخرج خلال دقايق.", "An ended device is signed out within minutes.")}
        </Text>
      </ScrollView>

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        destructive
        title={T("تقفل كل الأجهزة التانية؟", "Sign out all other devices?")}
        body={T("الجهاز ده بس هيفضل داخل.", "Only this device will stay signed in.")}
        confirmLabel={T("اقفلهم", "Sign them out")}
        onConfirm={async () => {
          try {
            const res = await end.mutateAsync("others");
            toast({ message: T(`اتقفل ${res.ended} جهاز`, `Signed out ${res.ended} device(s)`), tone: "ok" });
          } catch {
            toast({ message: T("معرفناش نقفلهم. حاول تاني.", "Couldn't sign them out. Try again."), tone: "danger" });
          } finally {
            setConfirmAll(false);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
});
