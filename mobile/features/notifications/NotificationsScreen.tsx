import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen, Text, Button, Card, ListState, colors, spacing } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { hrefFor } from "@/lib/links";
import { track } from "@/lib/analytics";
import type { AppNotification } from "@/types/api";
import { useMarkNotificationsRead, useNotifications } from "./queries";
import { pushStatus, registerForPush, type PushStatus } from "./push";

/**
 * The notification feed, for every role.
 *
 * The same feed the website's bell shows — notifications belong to the
 * account, so an owner sees new bookings here and a customer sees their
 * confirmations. Tapping one goes where its link points, through the
 * same table a push notification or a maw3ed.net link uses.
 */
export function NotificationsScreen() {
  return (
    <SignInGate title="الإشعارات" reason="عشان توصلك تحديثات حجوزاتك أول بأول.">
      <Feed />
    </SignInGate>
  );
}

function Feed() {
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = query.data?.notifications ?? [];

  // Opening the feed is reading it, as on the website.
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (unreadKey) markRead.mutate(unreadKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new batch
  }, [unreadKey]);

  function open(n: AppNotification) {
    track("notification_opened", { kind: n.kind, source: "feed" });
    if (n.href) router.navigate(hrefFor(n.href));
  }

  return (
    <Screen scroll={false}>
      <Text variant="title">الإشعارات</Text>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.jade}
          />
        }
      >
        <PushCard />
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={items.length === 0}
          emptyTitle="مفيش إشعارات لسه"
          emptyBody="أول ما يحصل جديد في حجوزاتك هيظهر هنا."
          onRetry={() => query.refetch()}
        >
          {items.map((n) => (
            <Card
              key={n.id}
              onPress={n.href ? () => open(n) : undefined}
              accessibilityLabel={`${n.readAt ? "" : "جديد: "}${n.title}${n.body ? `، ${n.body}` : ""}`}
            >
              <View style={styles.item}>
                {/* Unread is marked by a dot and by the word in the label, not by colour alone. */}
                {!n.readAt ? <View style={styles.dot} /> : null}
                <View style={styles.itemText}>
                  <Text variant="bodyBold">{n.title}</Text>
                  {n.body ? (
                    <Text variant="caption" tone="subtle" style={styles.body}>
                      {n.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const PUSH_COPY: Partial<Record<PushStatus, string>> = {
  undetermined: "فعّل الإشعارات عشان يوصلك تنبيه بكل حجز جديد أو تغيير في موعد.",
  denied: "الإشعارات مقفولة لموعد. تقدر تفتحها من إعدادات الموبايل.",
};

/** Asks for permission only here, when the person chooses to. */
function PushCard() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const copy = status ? PUSH_COPY[status] : undefined;
  if (!copy) return null;

  return (
    <View style={styles.push}>
      <Card>
        <Text variant="body">{copy}</Text>
        {status === "undetermined" ? (
          <View style={styles.pushAction}>
            <Button
              label="فعّل الإشعارات"
              loading={busy}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const next = await registerForPush({ prompt: true });
                  setStatus(next);
                  track("push_permission", { result: next });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  itemText: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.jade, marginTop: 7 },
  body: { marginTop: spacing.xs },
  push: { marginBottom: spacing.md },
  pushAction: { marginTop: spacing.md },
});
