import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, StyleSheet, Switch, View } from "react-native";
import { Button, Card, Text, colors, ltr, spacing, useLocale, useToast } from "@/design";
import { track } from "@/lib/analytics";
import { pushStatus, registerForPush, turnPushOff, type PushStatus } from "./push";

/**
 * "Notifications on this phone" — the push preference, which is the
 * device's registration itself (features/notifications/push.ts).
 *
 * Each state says what it is and offers the one thing that can change
 * it: turn on (asks the system once), turn off, or — once the system
 * permission was refused, which only the person can undo — the phone's
 * settings. Re-read whenever the app comes back to the foreground, since
 * that is where somebody returns from those settings.
 */
export function PushToggle({ compact = false, card = false }: { compact?: boolean; /** Draw its own card, so nothing is left empty while it loads. */ card?: boolean }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const refresh = useCallback(() => {
    pushStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (status === null) return null;

  const turn = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const next = await registerForPush({ prompt: true });
        setStatus(next);
        track("push_permission", { result: next });
      } else {
        await turnPushOff();
        setStatus("off");
        track("push_turned_off");
      }
    } catch {
      // Offline, or the platform refused a token: say so, and show the
      // switch as it really is.
      toast({ message: T("معرفناش نغيّر الإشعارات دلوقتي. جرّب تاني.", "Couldn't change notifications right now. Try again."), tone: "danger" });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const unavailable = status === "unsupported" || status === "not-configured";
  const on = status === "registered";

  const hint =
    status === "denied"
      ? T("الإشعارات مقفولة لموعد من إعدادات الموبايل.", "Notifications for Maw3ed are turned off in your phone's settings.")
      : status === "unsupported"
        ? T("الإشعارات بتشتغل على الموبايل نفسه، مش هنا.", "Push notifications work on a real phone, not here.")
        : status === "not-configured"
          ? T("الإشعارات مش متفعلة في النسخة دي من التطبيق.", "Push isn't set up in this build of the app.")
          : T(
              "تأكيد الحجز، التذكير قبل الميعاد، وأي تغيير من المكان.",
              "Confirmations, a reminder before your appointment, and any change by the business.",
            );

  const body = (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="body">{T("إشعارات على الموبايل ده", "Notifications on this phone")}</Text>
          <Text variant="caption" tone="subtle">
            {hint}
          </Text>
        </View>
        {status === "denied" || unavailable ? null : (
          <View style={Platform.OS === "web" ? ltr : undefined}>
            <Switch
              value={on}
              disabled={busy}
              onValueChange={(v) => void turn(v)}
              trackColor={{ true: colors.jade, false: colors.line2 }}
              accessibilityLabel={T("إشعارات على الموبايل ده", "Notifications on this phone")}
            />
          </View>
        )}
      </View>
      {status === "denied" ? (
        <Button size="sm" variant="outline" label={T("افتح الإعدادات", "Open settings")} onPress={() => void Linking.openSettings()} style={styles.start} />
      ) : null}
    </View>
  );
  return card ? <Card>{body}</Card> : body;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  compact: { marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
});
