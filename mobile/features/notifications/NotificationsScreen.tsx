import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Screen, Text, Card, ListState, colors, spacing, useLocale, joinLabel } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { hrefFor } from "@/lib/links";
import { track } from "@/lib/analytics";
import type { AppNotification } from "@/types/api";
import { fetchNotificationsPage, useMarkNotificationsRead, useNotifications } from "./queries";
import { relativeTime } from "@/lib/format";
import { PushToggle } from "./PushToggle";

/**
 * The notification feed, for every role.
 *
 * The same feed the website's bell shows — notifications belong to the
 * account, so an owner sees new bookings here and a customer sees their
 * confirmations. Tapping one goes where its link points, through the
 * same table a push notification or a maw3ed.net link uses.
 */
export function NotificationsScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <SignInGate
      title={ar ? "الإشعارات" : "Notifications"}
      reason={ar ? "عشان توصلك تحديثات حجوزاتك أول بأول." : "To get updates about your bookings as they happen."}
    >
      <Feed />
    </SignInGate>
  );
}

function Feed() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  // Older pages, fetched on "show more" and kept below the first page.
  // The first page is the query the tab badge shares; refreshing it
  // (marking read does) must not throw away what was loaded under it.
  const [older, setOlder] = useState<{ items: AppNotification[]; nextCursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const items = useMemo(() => {
    const first = query.data?.notifications ?? [];
    if (!older) return first;
    const seen = new Set(first.map((n) => n.id));
    return [...first, ...older.items.filter((n) => !seen.has(n.id))];
  }, [query.data, older]);
  const nextCursor = older ? older.nextCursor : (query.data?.nextCursor ?? null);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const page = await fetchNotificationsPage(nextCursor);
      setOlder((prev) => ({ items: [...(prev?.items ?? []), ...page.notifications], nextCursor: page.nextCursor ?? null }));
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function refresh() {
    setOlder(null);
    setMoreFailed(false);
    void query.refetch();
  }
  // "5 minutes ago" is read once per visit; it need not tick while open.
  const [now] = useState(() => Date.now());

  // Opening the feed is reading it, as on the website.
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (unreadKey) markRead.mutate(unreadKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new batch
  }, [unreadKey]);

  function open(n: AppNotification) {
    track("notification_opened", { kind: n.kind, source: "feed" });
    // A business notification about a booking opens that booking, not
    // the calendar its web link would lead to.
    if (n.bookingId && n.href?.startsWith("/dashboard")) {
      router.navigate({ pathname: "/manage/booking/[id]", params: { id: n.bookingId } });
      return;
    }
    if (n.href) router.navigate(hrefFor(n.href));
  }

  return (
    <Screen
      scroll={false}
      hero={
        <Text variant="display" tone="inverse" accessibilityRole="header">
          {T("الإشعارات", "Notifications")}
        </Text>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={refresh} tintColor={colors.jade} />}
      >
        <View style={styles.push}>
          <PushToggle card />
        </View>
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={items.length === 0}
          emptyIcon="notifications-outline"
          emptyTitle={T("مفيش إشعارات لسه", "No notifications yet")}
          emptyBody={T("أول ما يحصل جديد في حجوزاتك هيظهر هنا.", "Anything new about your bookings will show up here.")}
          onRetry={() => query.refetch()}
        >
          {items.map((n) => (
            <Card
              key={n.id}
              onPress={n.href ? () => open(n) : undefined}
              accessibilityLabel={`${n.readAt ? "" : T("جديد: ", "New: ")}${joinLabel(lang, n.title, n.body)}`}
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
                  <Text variant="tiny" tone="subtle" style={styles.body}>
                    {relativeTime(Math.min(0, Math.round((Date.parse(n.createdAt) - now) / 60_000)), lang)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
          {nextCursor ? (
            <View style={styles.more}>
              {moreFailed ? (
                <Text variant="caption" tone="danger" align="center">
                  {T("معرفناش نجيب الباقي. جرّب تاني.", "Couldn't load more. Try again.")}
                </Text>
              ) : null}
              <Button
                label={T("إشعارات أقدم", "Older notifications")}
                variant="outline"
                loading={loadingMore}
                onPress={() => void loadMore()}
                testID="notifications-more"
              />
            </View>
          ) : null}
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  itemText: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.jade, marginTop: 7 },
  body: { marginTop: spacing.xs },
  push: { marginBottom: spacing.md },
  more: { gap: spacing.sm, marginTop: spacing.sm },
});
