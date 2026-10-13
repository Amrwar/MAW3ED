import { useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Rating,
  ServiceCard,
  Skeleton,
  SkeletonCard,
  Text,
  colors,
  radius,
  spacing,
  useLocale,
} from "@/design";
import { FavoriteButton } from "@/features/discovery/FavoriteButton";
import { nextFreeLabel } from "@/features/discovery/BusinessCard";
import { useBusinessProfile } from "@/features/discovery/queries";
import { openSite } from "@/features/auth/AuthShell";
import { ApiError } from "@/lib/api/errors";
import { money, num, shortDate, time } from "@/lib/format";
import type { PublicProfile } from "@/types/api";

/**
 * One business.
 *
 * Everything shown is what GET /api/public/[slug] returned, and anything
 * missing is left out rather than filled in: no reviews shows "New", not
 * a rating; an unpriced service shows no price, not "free"; hours that
 * were never set show nothing, not "closed".
 *
 * Booking itself still happens on the website — the app's booking flow
 * is the next phase — so the button says where it goes.
 */

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const profile = useBusinessProfile(slug);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(customer)"));

  if (profile.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Skeleton height={200} radius={0} />
        <View style={styles.body}>
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" height={18} />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (!profile.data) {
    const missing = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <IconButton icon="chevron-back" label={ar ? "رجوع" : "Back"} onPress={back} variant="filled" />
        </View>
        {missing ? (
          <EmptyState
            icon="storefront-outline"
            title={ar ? "المكان ده مش متاح" : "This place isn't available"}
            body={ar ? "يمكن اتشال أو اتقفل. دوّر على مكان تاني." : "It may have been removed. Try searching for another."}
            action={<Button label={ar ? "ارجع للبحث" : "Back to search"} onPress={back} />}
          />
        ) : (
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        )}
      </View>
    );
  }

  return <Profile p={profile.data} onBack={back} />;
}

function Profile({ p, onBack }: { p: PublicProfile; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const name = (!ar && p.nameEn) || p.nameAr;
  const place = [
    p.neighborhood && (ar ? p.neighborhood.nameAr : p.neighborhood.nameEn),
    ar ? p.city.nameAr : p.city.nameEn,
  ]
    .filter(Boolean)
    .join(ar ? "، " : ", ");
  const next = nextFreeLabel(p.nextSlot, lang);
  const book = () => openSite(`/company/${p.slug}`);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* ── Cover ── */}
        <Cover uri={p.coverImage} />
        <View style={[styles.topBar, styles.floating, { top: insets.top + spacing.sm }]}>
          <IconButton icon="chevron-back" label={T("رجوع", "Back")} onPress={onBack} variant="filled" />
          <View style={styles.filled}>
            <FavoriteButton businessId={p.id} name={name} />
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Identity ── */}
          <View style={styles.identity}>
            <View style={styles.logo}>
              <Avatar name={name} uri={p.logoImage} size="xl" shape="rounded" />
            </View>
            <View style={styles.titleRow}>
              <Text variant="title" accessibilityRole="header" style={styles.flex}>
                {name}
              </Text>
              {p.isVerified ? <Icon name="checkmark-circle" color={colors.jade} label={T("موثّق", "Verified")} /> : null}
            </View>
            <Text variant="body" tone="muted">
              {(ar ? p.category.nameAr : p.category.nameEn) + " · " + place}
            </Text>
            {p.taglineAr && ar ? (
              <Text variant="body" tone="ink2">
                {p.taglineAr}
              </Text>
            ) : null}
          </View>

          {/* ── At a glance: only what is known ── */}
          <View style={styles.glance}>
            <Rating value={p.rating.average} count={p.rating.count} />
            {p.open.state === "open" ? (
              <Badge tone="ok" icon="time-outline" label={T(`مفتوح لحد ${time(p.open.closesAt, lang)}`, `Open until ${time(p.open.closesAt, lang)}`)} />
            ) : p.open.state === "closed" ? (
              <Badge tone="neutral" icon="time-outline" label={T("مقفول دلوقتي", "Closed now")} />
            ) : null}
            {next ? <Badge tone="jade" icon="flash-outline" label={next} /> : null}
            {p.autoConfirm ? <Badge tone="info" icon="checkmark-done-outline" label={T("تأكيد فوري", "Instant confirmation")} /> : null}
            {p.acceptsOnlinePayment ? <Badge tone="neutral" icon="card-outline" label={T("دفع أونلاين", "Pay online")} /> : null}
          </View>

          {/* ── Services ── */}
          {p.services.length > 0 ? (
            <Section title={T("الخدمات", "Services")}>
              {p.services.map((s) => (
                <ServiceCard
                  key={s.id}
                  name={(!ar && s.nameEn) || s.nameAr}
                  description={ar ? s.descriptionAr : null}
                  durationMinutes={s.durationMinutes}
                  price={s.price}
                  currency={s.currency}
                  onPress={book}
                />
              ))}
            </Section>
          ) : null}

          {p.images.length > 0 ? (
            <Section title={T("صور", "Photos")}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                {p.images.map((img) => (
                  <Image
                    key={img.url}
                    source={{ uri: img.url }}
                    style={styles.photo}
                    accessibilityLabel={img.caption ?? T("صورة من المكان", "Photo of the place")}
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {p.about ? (
            <Section title={T("عن المكان", "About")}>
              <Text variant="body" tone="ink2">
                {p.about}
              </Text>
            </Section>
          ) : null}

          {p.hours.length > 0 ? (
            <Section title={T("مواعيد العمل", "Opening hours")}>
              <Hours hours={p.hours} />
            </Section>
          ) : null}

          {p.address || p.branches.length > 0 ? (
            <Section title={T("العنوان", "Location")}>
              {p.address ? (
                <View style={styles.line}>
                  <Icon name="location-outline" color={colors.subtle} />
                  <Text variant="body" style={styles.flex}>
                    {p.address}
                  </Text>
                </View>
              ) : null}
              {p.branches.map((b) => (
                <View key={b.id} style={styles.line}>
                  <Icon name="business-outline" color={colors.subtle} />
                  <Text variant="body" style={styles.flex}>
                    {((!ar && b.nameEn) || b.nameAr) + (b.address ? ` — ${b.address}` : "")}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          {p.rating.count > 0 ? (
            <Section title={T(`التقييمات (${num(p.rating.count, lang)})`, `Reviews (${num(p.rating.count, lang)})`)}>
              {p.reviews.map((r) => (
                <Card key={r.id}>
                  <View style={styles.reviewHead}>
                    <Text variant="bodyBold" style={styles.flex}>
                      {r.authorName}
                    </Text>
                    <Text variant="label" tone="warn">
                      {"★".repeat(r.rating)}
                      <Text variant="label" tone="subtle">
                        {"★".repeat(5 - r.rating)}
                      </Text>
                    </Text>
                  </View>
                  <Text variant="caption" tone="subtle">
                    {[r.verifiedBooking ? T("حجز مؤكَّد", "Verified booking") : null, r.serviceName, shortDate(r.createdAt.slice(0, 10), lang)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {r.comment ? (
                    <Text variant="body" tone="ink2">
                      {r.comment}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}

          {p.whatsapp || p.phone ? (
            <Section title={T("تواصل", "Contact")}>
              <View style={styles.contact}>
                {p.whatsapp ? (
                  <Button
                    label={T("واتساب", "WhatsApp")}
                    icon="logo-whatsapp"
                    variant="outline"
                    onPress={() => Linking.openURL(`https://wa.me/${waDigits(p.whatsapp as string)}`).catch(() => undefined)}
                    style={styles.flex}
                  />
                ) : null}
                {p.phone ? (
                  <Button
                    label={T("اتصال", "Call")}
                    icon="call-outline"
                    variant="outline"
                    onPress={() => Linking.openURL(`tel:${(p.phone as string).replace(/[^\d+]/g, "")}`).catch(() => undefined)}
                    style={styles.flex}
                  />
                ) : null}
              </View>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Always in reach ── */}
      <View style={[styles.bookBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.flex}>
          {p.minPrice !== null ? (
            <Text variant="caption" tone="subtle">
              {T("الأسعار تبدأ من", "Prices from")}
            </Text>
          ) : null}
          {p.minPrice !== null ? (
            <Text variant="heading">{money(p.minPrice, p.currency, lang)}</Text>
          ) : (
            <Text variant="caption" tone="subtle">
              {T("الحجز بيكمّل على موقع مواعيد", "Booking continues on the Maw3ed website")}
            </Text>
          )}
        </View>
        <Button
          label={T("احجز موعد", "Book")}
          icon="open-outline"
          iconPosition="end"
          onPress={book}
          accessibilityHint={T("بيفتح صفحة الحجز على موقع مواعيد", "Opens the booking page on the Maw3ed website")}
        />
      </View>
    </View>
  );
}

function Cover({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <View style={[styles.cover, styles.coverFallback]} />;
  return (
    <Image
      source={{ uri }}
      style={styles.cover}
      onError={() => setFailed(true)}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

function Hours({ hours }: { hours: PublicProfile["hours"] }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const today = cairoWeekday();
  // Saturday first, as the week is read in Egypt.
  const order = [6, 0, 1, 2, 3, 4, 5];
  return (
    <Card>
      {order.map((d) => {
        const rule = hours.find((h) => h.dayOfWeek === d);
        const isToday = d === today;
        return (
          <View key={d} style={[styles.hoursRow, isToday && styles.today]}>
            <Text variant={isToday ? "bodyBold" : "body"} style={styles.flex}>
              {(ar ? DAYS_AR : DAYS_EN)[d]}
            </Text>
            <Text variant={isToday ? "bodyBold" : "body"} tone={rule && !rule.isClosed ? "ink" : "subtle"}>
              {!rule
                ? "—"
                : rule.isClosed
                  ? ar
                    ? "مقفول"
                    : "Closed"
                  : `${time(rule.openTime, lang)} – ${time(rule.closeTime, lang)}`}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Weekday in Cairo, 0 = Sunday — where the business keeps its hours. */
function cairoWeekday(): number {
  try {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
  } catch {
    return new Date().getDay();
  }
}

/** wa.me wants international digits; a local 01… number is Egyptian. */
function waDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return d;
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return "20" + d.slice(1);
  return d;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  centre: { justifyContent: "center" },
  flex: { flex: 1 },
  cover: { width: "100%", height: 220, backgroundColor: colors.surface3 },
  coverFallback: { backgroundColor: colors.night },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  floating: { position: "absolute", start: 0, end: 0 },
  filled: { backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  identity: { gap: spacing.xs, marginTop: -44 },
  logo: { alignSelf: "flex-start", borderRadius: radius.lg, borderWidth: 3, borderColor: colors.ground, backgroundColor: colors.surface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  glance: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  section: { gap: spacing.md },
  gallery: { gap: spacing.sm },
  photo: { width: 220, height: 150, borderRadius: radius.md, backgroundColor: colors.surface3 },
  line: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  hoursRow: { flexDirection: "row", paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.xs, borderRadius: radius.xs },
  today: { backgroundColor: colors.jadeTint },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  contact: { flexDirection: "row", gap: spacing.md },
  bookBar: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
