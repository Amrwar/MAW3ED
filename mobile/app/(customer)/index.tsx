import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Sheet,
  SkeletonCard,
  Skeleton,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
  useLayout,
  useLocale,
  type IconName,
} from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { startSearch, type Arrival } from "@/features/discovery/searchState";
import { BookingCard } from "@/features/bookings/BookingCard";
import { statusLabelFor } from "@/features/bookings/status";
import { useBusinesses, useFacets, useMyBookings } from "@/features/customer/queries";
import { useHomeCity } from "@/features/customer/useHomeCity";
import { useUnreadCount } from "@/features/notifications/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { startSignIn } from "@/features/auth/AuthShell";
import { num } from "@/lib/format";
import { api } from "@/lib/api/client";
import { forgetPayment, unfinishedPayments } from "@/features/booking/storage";
import type { Business } from "@/types/api";

/**
 * Home: discovery first, then booking.
 *
 * Everything on it is real. Each row is a query against the same
 * discovery the website runs, and a row with nothing honest to show is
 * left out rather than padded:
 *
 *  - "Available today" lists businesses with a real free slot today.
 *  - "Top rated" lists only businesses people have actually rated.
 *  - "Most booked" appears only if bookings exist, and never shows a
 *    number — the ordering is the claim, and it is a true one.
 *  - The city row shows the server's own total, so five places reads as
 *    five places.
 *
 * "Nearby" is the chosen city: businesses are filed by city, not by
 * coordinates, so that is the most the data can honestly say. There is
 * no "recently viewed" — nothing in the app or the API records views
 * per person yet (the business profile screen does not exist).
 */

const CATEGORY_ICONS: Record<string, IconName> = {
  clinics: "medkit-outline",
  dentists: "happy-outline",
  labs: "flask-outline",
  salons: "cut-outline",
  "beauty-centers": "sparkles-outline",
  spas: "water-outline",
  gyms: "barbell-outline",
  restaurants: "restaurant-outline",
  consulting: "briefcase-outline",
  legal: "document-text-outline",
  "home-services": "home-outline",
  "car-services": "car-outline",
  photography: "camera-outline",
  education: "school-outline",
};

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const { user } = useAuth();
  const { city, setCity } = useHomeCity();
  const [picking, setPicking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const ready = city !== null;
  const where = city ?? "";
  // Nothing is asked for until the saved city is known — otherwise every
  // row loads "all cities" first and then again for the chosen one.
  const facets = useFacets(where || undefined, ready);
  const upcoming = useMyBookings("upcoming", Boolean(user));
  const unread = useUnreadCount(Boolean(user));
  const all = useBusinesses({ city: where }, ready);
  const today = useBusinesses({ city: where, available: "today", sort: "soonest" }, ready);
  const topRated = useBusinesses({ city: where, sort: "rating" }, ready);
  const mostBooked = useBusinesses({ city: where, sort: "most-booked" }, ready);

  // When discovery as a whole is down, one error and one retry — not four
  // error boxes, each fixing only its own row.
  const discovery = [all, today, topRated, mostBooked];
  const discoveryDown = discovery.every((q) => q.error);
  const retryDiscovery = () => discovery.forEach((q) => q.refetch());

  const cityRow = facets.data?.cities.find((c) => c.slug === where);
  const cityName = cityRow ? (ar ? cityRow.nameAr : cityRow.nameEn) : T("كل المدن", "All cities");
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const next = upcoming.data?.bookings[0];

  const rated = (topRated.data?.businesses ?? []).filter((b) => b.ratingCount > 0);
  const booked = (mostBooked.data?.businesses ?? []).filter((b) => b.bookingCount > 0);
  // The server's "today" means open today; a free slot today is what the
  // row promises, so a fully booked or already-closed place is left out.
  const openToday = (today.data?.businesses ?? []).filter((b) => b.nextSlot?.dayOffset === 0);
  const categories = (facets.data?.categories ?? []).filter((c) => c.count > 0);

  async function refresh() {
    setRefreshing(true);
    try {
      // Only what this screen shows — not every list cached elsewhere.
      await Promise.all(
        // refetch() ignores `enabled`, so a signed-out person's bookings are not asked for.
        [facets, ...discovery, ...(user ? [upcoming] : [])].map((q) => q.refetch()),
      );
    } finally {
      setRefreshing(false);
    }
  }

  // A new search in the home city, written to the search store before
  // Search opens (features/discovery/searchState.ts).
  const openSearch = (params: Arrival = {}) => {
    startSearch({ city: where, ...params });
    router.push("/(customer)/search");
  };
  const openBusiness = (b: Business) => router.push({ pathname: "/business/[slug]", params: { slug: b.slug } });

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.inverse}
          colors={[colors.jade]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {/* ── Deep Anchor: the app opens on night ── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <Column>
          <View style={styles.heroTop}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={T(`المدينة: ${cityName}. غيّرها`, `City: ${cityName}. Change`)}
              onPress={() => setPicking(true)}
              style={styles.cityButton}
              rippleColor={colors.nightLine}
            >
              <Icon name="location" size="sm" color={colors.nightAccent} />
              <Text variant="label" tone="inverse" numberOfLines={1}>
                {cityName}
              </Text>
              <Icon name="chevron-down" size="sm" color={colors.nightText} />
            </Touchable>

            {user ? (
              <View>
                <IconButton
                  icon="notifications-outline"
                  variant="night"
                  label={
                    unread
                      ? T(`الإشعارات، ${unread} جديد`, `Notifications, ${unread} new`)
                      : T("الإشعارات", "Notifications")
                  }
                  onPress={() => router.push("/(customer)/notifications")}
                />
                {unread ? <View style={styles.dot} /> : null}
              </View>
            ) : (
              <Button
                label={T("دخول", "Sign in")}
                variant="night"
                size="sm"
                onPress={() => startSignIn()}
              />
            )}
          </View>

          <Text variant="title" tone="inverse" accessibilityRole="header" style={styles.greeting}>
            {firstName
              ? T(`أهلاً، ${firstName}`, `Hello, ${firstName}`)
              : T("أهلاً بيك", "Welcome")}
          </Text>
          <Text variant="body" tone="inverseMuted">
            {T("احجز موعدك في ثواني.", "Book your appointment in seconds.")}
          </Text>

          <Touchable
            accessibilityRole="search"
            accessibilityLabel={T("ابحث عن مكان أو خدمة", "Search for a place or service")}
            onPress={() => openSearch()}
            style={styles.searchPill}
          >
            <Icon name="search" color={colors.subtle} />
            <Text variant="body" tone="subtle" numberOfLines={1}>
              {T("دكتور، صالون، جيم…", "Doctor, salon, gym…")}
            </Text>
          </Touchable>

          <Button
            label={T("أماكن قريبة مني", "Places near me")}
            icon="navigate-outline"
            variant="night"
            size="sm"
            onPress={() => router.push("/nearby")}
            style={styles.nearMe}
          />
        </Column>
      </View>

      <Column>
        {/* ── A deposit left unfinished when the app was closed ── */}
        <UnfinishedPayment />

        {/* ── The next appointment, when there is one ── */}
        {user && next ? (
          <Section title={T("موعدك الجاي", "Your next appointment")}>
            <BookingCard
              title={ar ? next.business.nameAr : (next.business.nameEn ?? next.business.nameAr)}
              subtitle={(!ar && next.serviceNameEn) || next.serviceName}
              date={next.date}
              startTime={next.startTime}
              endTime={next.endTime}
              status={next.status}
              statusLabel={statusLabelFor(next.status, lang)}
              price={next.totalPrice}
              currency={next.currency}
              minutesUntil={next.minutesUntil}
              // Straight to the booking itself — where it can be moved or cancelled.
              onPress={() =>
                next.accessToken
                  ? router.push({ pathname: "/booking/[token]", params: { token: next.accessToken } })
                  : router.push("/(customer)/bookings")
              }
            />
          </Section>
        ) : null}

        {/* ── Categories that have something in them ── */}
        <Section title={T("الأقسام", "Categories")}>
          {facets.isLoading || !ready ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.categorySkeleton}>
                  <Skeleton width={56} height={56} radius={28} />
                  <Skeleton width={56} height={12} />
                </View>
              ))}
            </ScrollView>
          ) : facets.error ? (
            <ErrorState error={facets.error} onRetry={() => facets.refetch()} />
          ) : categories.length === 0 ? (
            <Text variant="caption" tone="subtle">
              {T("لسه مفيش أقسام فيها أماكن.", "No categories have places yet.")}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {categories.map((c) => {
                const name = ar ? c.nameAr : c.nameEn;
                return (
                  <Touchable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={T(
                      `${name}، ${num(c.count)} مكان`,
                      `${name}, ${c.count} places`,
                    )}
                    onPress={() => openSearch({ category: c.slug })}
                    style={styles.category}
                  >
                    <View style={styles.categoryIcon}>
                      <Icon
                        name={CATEGORY_ICONS[c.slug] ?? "grid-outline"}
                        size="lg"
                        color={colors.jade}
                      />
                    </View>
                    <Text variant="tiny" align="center" numberOfLines={2}>
                      {name}
                    </Text>
                  </Touchable>
                );
              })}
            </ScrollView>
          )}
        </Section>

        {discoveryDown ? (
          <Section title={T("الأماكن", "Places")}>
            <ErrorState error={all.error} onRetry={retryDiscovery} />
          </Section>
        ) : (
          <>
            {/* ── Real free slots today ── */}
            <Rail
              title={T("متاح النهارده", "Available today")}
              note={T("أماكن عندها مواعيد فاضية النهارده", "Places with free times today")}
              query={today}
              items={openToday}
              onPress={openBusiness}
              onSeeAll={() =>
                openSearch({ sort: "soonest", available: "today" })
              }
            />

            {/* ── Only places people have actually rated ── */}
            <Rail
              title={T("الأعلى تقييماً", "Top rated")}
              query={topRated}
              items={rated}
              onPress={openBusiness}
              onSeeAll={() =>
                openSearch({ sort: "rating" })
              }
            />

            {/* ── Ordered by real bookings; no number is shown ── */}
            <Rail
              title={T("الأكثر حجزاً", "Most booked")}
              query={mostBooked}
              items={booked}
              onPress={openBusiness}
              onSeeAll={() =>
                openSearch({ sort: "most-booked" })
              }
            />

            {/* ── Everything in the chosen city, with the honest total ── */}
            <Section
              title={where ? T(`في ${cityName}`, `In ${cityName}`) : T("كل الأماكن", "All places")}
              action={
                all.data && all.data.total > 0 ? (
                  <Button
                    label={T(`عرض الكل (${num(all.data.total)})`, `See all (${all.data.total})`)}
                    variant="ghost"
                    size="sm"
                    onPress={() => openSearch()}
                  />
                ) : null
              }
            >
              {all.isLoading || !ready ? (
                <View style={styles.list}>
                  <SkeletonCard />
                  <SkeletonCard />
                </View>
              ) : all.error ? (
                <ErrorState error={all.error} onRetry={() => all.refetch()} />
              ) : (all.data?.businesses.length ?? 0) === 0 ? (
                <EmptyState
                  icon="storefront-outline"
                  title={
                    where
                      ? T(`لسه مفيش أماكن في ${cityName}`, `No places in ${cityName} yet`)
                      : T("لسه مفيش أماكن", "No places yet")
                  }
                  body={T("أول ما تتضاف أماكن هتلاقيها هنا.", "New places will show up here.")}
                  action={
                    where ? (
                      <Button
                        label={T("كل المدن", "All cities")}
                        variant="outline"
                        onPress={() => setCity("")}
                      />
                    ) : undefined
                  }
                />
              ) : (
                <View style={styles.list}>
                  {all.data?.businesses.slice(0, 6).map((b) => (
                    <BusinessCard key={b.id} business={b} onPress={() => openBusiness(b)} />
                  ))}
                </View>
              )}
            </Section>
          </>
        )}
      </Column>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={T("اختر المدينة", "Choose a city")}
      >
        <View accessibilityRole="radiogroup">
          {[
            { slug: "", nameAr: "كل المدن", nameEn: "All cities", count: null as number | null },
            ...(facets.data?.cities ?? []).filter((c) => c.count > 0),
          ].map((c) => {
            const selected = c.slug === where;
            const name = ar ? c.nameAr : c.nameEn;
            return (
              <Touchable
                key={c.slug || "all"}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={
                  c.count === null
                    ? name
                    : T(`${name}، ${num(c.count)} مكان`, `${name}, ${c.count} places`)
                }
                onPress={() => {
                  setCity(c.slug);
                  setPicking(false);
                }}
                style={[styles.cityOption, selected && styles.cityOptionOn]}
              >
                <Icon
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  color={selected ? colors.jade : colors.line2}
                />
                <Text variant={selected ? "bodyBold" : "body"} style={styles.flex}>
                  {name}
                </Text>
                {c.count !== null ? (
                  <Text variant="caption" tone="subtle">
                    {T(`${num(c.count)} مكان`, `${c.count} places`)}
                  </Text>
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </Sheet>
    </ScrollView>
  );
}

/** Content column: full width on a phone, a capped column on a tablet. */
function Column({ children }: { children: ReactNode }) {
  const { contentWidth, gutter } = useLayout();
  return (
    <View
      style={{
        width: "100%",
        maxWidth: contentWidth + gutter * 2,
        alignSelf: "center",
        paddingHorizontal: gutter,
      }}
    >
      {children}
    </View>
  );
}

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {note ? (
            <Text variant="caption" tone="subtle">
              {note}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * A horizontal row of businesses. Shows skeletons while loading, the
 * error with a retry if it failed, and — when there is nothing true to
 * put in it — nothing at all: an empty "Top rated" row is worse than
 * none.
 */
function Rail({
  title,
  note,
  query,
  items,
  onPress,
  onSeeAll,
}: {
  title: string;
  note?: string;
  query: { isLoading: boolean; error: unknown; refetch: () => unknown };
  items: Business[];
  onPress: (b: Business) => void;
  onSeeAll: () => void;
}) {
  const { width, columns } = useLayout();
  const { lang } = useLocale();
  const cardWidth = Math.min(320, columns > 1 ? 320 : width * 0.8);

  if (!query.isLoading && !query.error && items.length === 0) return null;

  return (
    <Section
      title={title}
      note={note}
      action={
        items.length > 2 ? (
          <Button
            label={lang === "ar" ? "عرض الكل" : "See all"}
            variant="ghost"
            size="sm"
            onPress={onSeeAll}
          />
        ) : null
      }
    >
      {query.isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {[0, 1].map((i) => (
            <View key={i} style={{ width: cardWidth }}>
              <SkeletonCard />
            </View>
          ))}
        </ScrollView>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {items.slice(0, 8).map((b) => (
            <View key={b.id} style={{ width: cardWidth }}>
              <BusinessCard business={b} variant="feature" onPress={() => onPress(b)} />
            </View>
          ))}
        </ScrollView>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.night,
    paddingBottom: spacing.xl,
    borderBottomStartRadius: radius.xl,
    borderBottomEndRadius: radius.xl,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    minHeight: 40,
    maxWidth: "70%",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.night2,
    borderWidth: 1,
    borderColor: colors.nightLine,
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    top: 10,
    end: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.star,
    borderWidth: 2,
    borderColor: colors.night,
  },
  greeting: { marginTop: spacing.xl },
  nearMe: { alignSelf: "flex-start", marginTop: spacing.sm },
  searchPill: {
    marginTop: spacing.lg,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  section: { marginTop: spacing.xxl, gap: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rail: { gap: spacing.md, paddingVertical: spacing.xxs },
  category: {
    width: 76,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.jadeSoft,
    borderWidth: 1,
    borderColor: colors.jadeLine,
  },
  categorySkeleton: { width: 76, alignItems: "center", gap: spacing.xs },
  list: { gap: spacing.md },
  cityOption: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  cityOptionOn: { backgroundColor: colors.jadeTint },
});

/**
 * "Finish your payment" — for a deposit started on this phone whose
 * booking the server still holds waiting for it. The server is asked; the
 * reminder only shows while the booking really is waiting.
 */
function UnfinishedPayment() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const pending = useQuery({
    queryKey: ["booking", "unfinished"],
    queryFn: async () => {
      const list = await unfinishedPayments();
      const checked = await Promise.all(
        list.map(async (p) => {
          try {
            const b = await api.get<{ status: string }>(`/api/public/booking/${encodeURIComponent(p.token)}`, { anonymous: true });
            if (b.status === "PENDING_PAYMENT") return p;
            await forgetPayment(p.token);
          } catch {
            /* not reachable now: say nothing rather than guess */
          }
          return null;
        }),
      );
      return checked.filter((x): x is { token: string; label: string | null } => x !== null);
    },
    staleTime: 30_000,
  });
  const first = pending.data?.[0];
  if (!first) return null;
  return (
    <Card onPress={() => router.push({ pathname: "/booking/[token]", params: { token: first.token } })} accessibilityLabel={ar ? "كمّل الدفع" : "Finish your payment"}>
      <View style={homeStyles.payRow}>
        <Icon name="card-outline" color={colors.warn} />
        <View style={homeStyles.flex}>
          <Text variant="bodyBold">{ar ? "كمّل دفع العربون" : "Finish paying your deposit"}</Text>
          <Text variant="caption" tone="subtle">
            {first.label
              ? ar
                ? `ميعادك في ${first.label} محجوز لحد ما الدفع يتم.`
                : `Your time at ${first.label} is held until payment is done.`
              : ar
                ? "ميعادك محجوز لحد ما الدفع يتم."
                : "Your time is held until payment is done."}
          </Text>
        </View>
        <Icon name={ar ? "chevron-back" : "chevron-forward"} color={colors.faint} />
      </View>
    </Card>
  );
}

const homeStyles = StyleSheet.create({
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
});
