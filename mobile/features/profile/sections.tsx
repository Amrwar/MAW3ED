import type { ReactNode } from "react";
import { sized } from "@/lib/image";
import { Image, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Avatar, Badge, Button, Card, Icon, Text, Touchable, colors, radius, spacing, useLocale } from "@/design";
import { nextFreeLabel } from "@/features/discovery/BusinessCard";
import { duration, num, shortDate, time } from "@/lib/format";
import type { BookingPolicies, DayHours, PublicProfile, PublicReview, PublicStaffMember } from "@/types/api";
import { directionsUrl, pinDirectionsUrl, profilePins, telUrl, workingDays, type ProfileKind, type Seating } from "./profile";
import { PlacesMap } from "@/features/location/PlacesMap";

/**
 * The pieces of a business profile. Each takes real data and renders
 * nothing when there is none — the screen decides order, these decide
 * how a thing looks.
 */

export const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT_AR = ["أحد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"];
const DAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Saturday first, as the week is read in Egypt. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];

export function Section({
  title,
  action,
  children,
  testID,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHead}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Weekday in Cairo, 0 = Sunday — where the business keeps its hours. */
export function cairoWeekday(): number {
  try {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(new Date());
    return DAYS_SHORT_EN.indexOf(short);
  } catch {
    return new Date().getDay();
  }
}

/** An instant's calendar day in Cairo, YYYY-MM-DD — not UTC's, which is a day behind after midnight. */
export function cairoDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

/* ─── Hours ──────────────────────────────────────────────── */

export function HoursTable({ hours }: { hours: DayHours[] }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const today = cairoWeekday();
  return (
    <Card>
      {WEEK.map((d) => {
        const rule = hours.find((h) => h.dayOfWeek === d);
        const isToday = d === today;
        return (
          <View key={d} style={[styles.hoursRow, isToday && styles.today]}>
            <Text variant={isToday ? "bodyBold" : "body"} style={styles.flex}>
              {(ar ? DAYS_AR : DAYS_EN)[d]}
              {isToday ? (ar ? " (النهارده)" : " (today)") : ""}
            </Text>
            <Text variant={isToday ? "bodyBold" : "body"} tone={rule && !rule.isClosed ? "ink" : "subtle"}>
              {!rule ? "—" : rule.isClosed ? (ar ? "مقفول" : "Closed") : `${time(rule.openTime, lang)} – ${time(rule.closeTime, lang)}`}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

/** "Sat, Sun, Mon" — the days somebody works, Saturday first. */
export function daysLabel(hours: DayHours[], lang: "ar" | "en"): string | null {
  const days = new Set(workingDays(hours));
  if (days.size === 0) return null;
  if (days.size === 7) return lang === "ar" ? "كل أيام الأسبوع" : "Every day";
  return WEEK.filter((d) => days.has(d))
    .map((d) => (lang === "ar" ? DAYS_SHORT_AR : DAYS_SHORT_EN)[d])
    .join(lang === "ar" ? "، " : ", ");
}

/* ─── Ratings ────────────────────────────────────────────── */

/**
 * The average, and how the votes spread across five stars. Only drawn
 * when somebody has reviewed — five empty bars say nothing.
 */
export function RatingBreakdown({ rating }: { rating: PublicProfile["rating"] }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  if (rating.count === 0 || rating.average === null) return null;
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((s) => rating.distribution[String(s) as "1"] ?? 0));
  return (
    <Card>
      <View style={styles.breakdown}>
        <View style={styles.average}>
          <Text variant="display">{num(rating.average, lang)}</Text>
          <Stars value={rating.average} />
          <Text variant="caption" tone="subtle" align="center">
            {ar ? `${num(rating.count, lang)} تقييم` : `${num(rating.count, lang)} ${rating.count === 1 ? "review" : "reviews"}`}
          </Text>
        </View>
        <View style={styles.bars}>
          {[5, 4, 3, 2, 1].map((s) => {
            const n = rating.distribution[String(s) as "1"] ?? 0;
            return (
              <View
                key={s}
                style={styles.barRow}
                accessible
                accessibilityLabel={ar ? `${num(s, lang)} نجوم: ${num(n, lang)}` : `${s} stars: ${n}`}
              >
                <Text variant="tiny" tone="muted" style={styles.barLabel}>
                  {num(s, lang)}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(n / max) * 100}%` }]} />
                </View>
                <Text variant="tiny" tone="subtle" style={styles.barCount}>
                  {num(n, lang)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <Text variant="label" tone="warn" accessibilityElementsHidden importantForAccessibility="no">
      {"★".repeat(full)}
      <Text variant="label" tone="subtle">
        {"★".repeat(5 - full)}
      </Text>
    </Text>
  );
}

/** `action` is a quiet control under the review — the reviews screen puts "Report" there. */
export function ReviewItem({ review, action }: { review: PublicReview; action?: ReactNode }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <Card>
      <View style={styles.reviewHead}>
        <Avatar name={review.authorName} size="sm" />
        <View style={styles.flex}>
          <Text variant="bodyBold">{review.authorName}</Text>
          <Text variant="caption" tone="subtle">
            {[review.verifiedBooking ? (ar ? "حجز مؤكَّد" : "Verified booking") : null, review.serviceName, shortDate(cairoDate(review.createdAt), lang)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <View accessible accessibilityLabel={ar ? `${num(review.rating, lang)} من ${num(5, lang)}` : `${review.rating} out of 5`}>
          <Stars value={review.rating} />
        </View>
      </View>
      {review.comment ? (
        <Text variant="body" tone="ink2">
          {review.comment}
        </Text>
      ) : null}
      {review.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotos}>
          {review.photos.map((url) => (
            <Image key={url} source={{ uri: sized(url, 88) }} style={styles.reviewPhoto} accessibilityLabel={ar ? "صورة من التقييم" : "Photo from the review"} />
          ))}
        </ScrollView>
      ) : null}
      {action}
    </Card>
  );
}

/* ─── People ─────────────────────────────────────────────── */

/**
 * A salon's team, side by side to pick from — the next free time under
 * each name is theirs, not the shop's.
 */
export function TeamStrip({ staff, onOpen }: { staff: PublicStaffMember[]; onOpen: (m: PublicStaffMember) => void }) {
  const { lang } = useLocale();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.team}>
      {staff.map((m) => {
        const name = (lang === "en" && m.nameEn) || m.nameAr;
        const next = nextFreeLabel(m.nextSlot, lang);
        return (
          <Card key={m.id} onPress={() => onOpen(m)} style={styles.member} accessibilityLabel={[name, m.role, next].filter(Boolean).join(", ")}>
            <Avatar name={name} uri={m.photo} size="lg" />
            <Text variant="label" align="center" numberOfLines={2}>
              {name}
            </Text>
            {m.role ? (
              <Text variant="tiny" tone="subtle" align="center" numberOfLines={1}>
                {m.role}
              </Text>
            ) : null}
            {next ? (
              <Text variant="tiny" tone="jade" align="center" numberOfLines={2}>
                {next}
              </Text>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

/**
 * A clinic's doctors: one per row, with what they treat and when they
 * see patients, because that is how people choose a doctor.
 */
export function ProviderList({ staff, onOpen }: { staff: PublicStaffMember[]; onOpen: (m: PublicStaffMember) => void }) {
  const { lang } = useLocale();
  return (
    <View style={styles.list}>
      {staff.map((m) => {
        const name = (lang === "en" && m.nameEn) || m.nameAr;
        const next = nextFreeLabel(m.nextSlot, lang);
        const days = daysLabel(m.hours, lang);
        return (
          <Card key={m.id} onPress={() => onOpen(m)} accessibilityLabel={[name, m.role, ...m.specialties, days, next].filter(Boolean).join(", ")}>
            <View style={styles.provider}>
              <Avatar name={name} uri={m.photo} size="md" />
              <View style={[styles.flex, styles.providerText]}>
                <Text variant="bodyBold">{name}</Text>
                {m.role ? (
                  <Text variant="caption" tone="muted">
                    {m.role}
                  </Text>
                ) : null}
                {m.specialties.length > 0 ? (
                  <View style={styles.tags}>
                    {m.specialties.slice(0, 3).map((s) => (
                      <Badge key={s} label={s} tone="neutral" />
                    ))}
                    {m.specialties.length > 3 ? <Badge label={`+${num(m.specialties.length - 3, lang)}`} tone="neutral" /> : null}
                  </View>
                ) : null}
                {days ? (
                  <Text variant="caption" tone="subtle">
                    {days}
                  </Text>
                ) : null}
                {next ? (
                  <Text variant="caption" tone="jade">
                    {next}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron-forward" color={colors.faint} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

/* ─── Dining ─────────────────────────────────────────────── */

export function SeatingCard({ seating }: { seating: Seating }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const lines: { icon: "people-outline" | "restaurant-outline" | "leaf-outline"; text: string }[] = [];
  if (seating.seats) {
    const { min, max } = seating.seats;
    lines.push({
      icon: "people-outline",
      text:
        min === max
          ? ar
            ? `ترابيزات لـ ${num(max, lang)} أشخاص`
            : `Tables for ${max}`
          : ar
            ? `ترابيزات من ${num(min, lang)} لـ ${num(max, lang)} أشخاص`
            : `Tables for ${min} to ${max} guests`,
    });
  }
  lines.push({
    icon: "restaurant-outline",
    text: ar ? `${num(seating.count, lang)} ترابيزة بتتحجز` : `${seating.count} bookable ${seating.count === 1 ? "table" : "tables"}`,
  });
  return (
    <Card>
      {lines.map((l) => (
        <View key={l.text} style={styles.line}>
          <Icon name={l.icon} color={colors.jade} />
          <Text variant="body" style={styles.flex}>
            {l.text}
          </Text>
        </View>
      ))}
      {seating.areas.length > 0 ? (
        <View style={styles.line}>
          <Icon name="leaf-outline" color={colors.jade} />
          <View style={[styles.flex, styles.tags]}>
            {seating.areas.map((a) => (
              <Badge key={a} label={a} tone="jade" />
            ))}
          </View>
        </View>
      ) : null}
      {seating.seats ? (
        <Text variant="caption" tone="subtle">
          {ar ? "هتختار عدد الأشخاص والترابيزة وانت بتحجز." : "You'll choose your party size and table when you book."}
        </Text>
      ) : null}
    </Card>
  );
}

/* ─── Location ───────────────────────────────────────────── */

export function LocationCard({
  p,
  onOpenUrl,
}: {
  p: PublicProfile;
  onOpenUrl: (url: string) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const area = [p.neighborhood && (ar ? p.neighborhood.nameAr : p.neighborhood.nameEn), ar ? p.city.nameAr : p.city.nameEn]
    .filter(Boolean)
    .join(ar ? "، " : ", ");
  // The owner's pin when there is one; otherwise a maps search for the
  // written address — never a pin placed from it.
  const directions = p.location ? pinDirectionsUrl(p.location) : directionsUrl([p.address, p.neighborhood?.nameEn, p.city.nameEn]);
  const branches = p.branches;
  const pins = profilePins(p);
  const name = (!ar && p.nameEn) || p.nameAr;

  return (
    <View style={styles.list}>
      <Card>
        {p.address ? (
          <View style={styles.line}>
            <Icon name="location-outline" color={colors.jade} />
            <View style={styles.flex}>
              <Text variant="body">{p.address}</Text>
              <Text variant="caption" tone="subtle">
                {area}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.line}>
            <Icon name="location-outline" color={colors.jade} />
            <Text variant="body" style={styles.flex}>
              {area}
            </Text>
          </View>
        )}
        {pins.length > 0 ? (
          <View style={styles.map}>
            <PlacesMap points={pins} names={{ [p.id]: name }} around={null} onOpen={() => undefined} height={200} showOpen={false} />
          </View>
        ) : null}
        {(p.location || p.address) && directions ? (
          <Button
            label={ar ? "الاتجاهات" : "Directions"}
            icon="navigate-outline"
            variant="outline"
            onPress={() => onOpenUrl(directions)}
            accessibilityHint={ar ? "بيفتح العنوان في الخرايط" : "Opens the address in Maps"}
          />
        ) : null}
      </Card>

      {branches.length > 0 ? (
        <>
          <Text variant="label" tone="muted">
            {ar ? `الفروع (${num(branches.length, lang)})` : `Branches (${branches.length})`}
          </Text>
          {branches.map((b) => {
            const name = (!ar && b.nameEn) || b.nameAr;
            const to = b.location ? pinDirectionsUrl(b.location) : b.address ? directionsUrl([b.address, p.city.nameEn]) : null;
            const tel = b.phone ? telUrl(b.phone) : null;
            return (
              <Card key={b.id}>
                <View style={styles.line}>
                  <Icon name="business-outline" color={colors.subtle} />
                  <View style={styles.flex}>
                    <Text variant="bodyBold">{name}</Text>
                    {b.address ? (
                      <Text variant="caption" tone="muted">
                        {b.address}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {to || tel ? (
                  <View style={styles.row}>
                    {to ? (
                      <Button size="sm" variant="ghost" icon="navigate-outline" label={ar ? "الاتجاهات" : "Directions"} onPress={() => onOpenUrl(to)} />
                    ) : null}
                    {tel ? (
                      <Button size="sm" variant="ghost" icon="call-outline" label={ar ? "اتصل بالفرع" : "Call branch"} onPress={() => onOpenUrl(tel)} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

/* ─── Policies ───────────────────────────────────────────── */

/**
 * The rules a booking is made under, each from a real setting. Nothing
 * here is a promise the booking will not keep: the deposit line only
 * appears when the plan really takes one.
 */
export function PolicyList({ policies, autoConfirm }: { policies: BookingPolicies; autoConfirm: boolean }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const rows: { icon: "checkmark-done-outline" | "hourglass-outline" | "card-outline" | "time-outline" | "calendar-outline"; text: string }[] = [
    autoConfirm
      ? { icon: "checkmark-done-outline", text: ar ? "الحجز بيتأكد على طول" : "Bookings are confirmed instantly" }
      : { icon: "hourglass-outline", text: ar ? "المكان بيأكد كل حجز بنفسه" : "The business confirms each booking" },
  ];
  if (policies.depositPercent) {
    rows.push({
      icon: "card-outline",
      text: ar
        ? `بتدفع عربون ${num(policies.depositPercent, lang)}٪ أونلاين عشان تثبّت الحجز`
        : `A ${policies.depositPercent}% deposit is paid online to hold your booking`,
    });
  }
  if (policies.minNoticeMinutes > 0) {
    rows.push({
      icon: "time-outline",
      text: ar
        ? `الحجز قبلها بـ ${duration(policies.minNoticeMinutes, lang)} على الأقل`
        : `Book at least ${duration(policies.minNoticeMinutes, lang)} ahead`,
    });
  }
  if (policies.sameDayCutoff) {
    rows.push({
      icon: "time-outline",
      text: ar
        ? `حجز نفس اليوم لحد ${time(policies.sameDayCutoff, lang)}`
        : `Same-day bookings until ${time(policies.sameDayCutoff, lang)}`,
    });
  }
  rows.push({
    icon: "calendar-outline",
    text: ar
      ? `تقدر تلغي أو تغيّر ميعادك بنفسك لحد ${duration(policies.changeCutoffHours * 60, "ar")} قبله`
      : `Cancel or reschedule yourself up to ${policies.changeCutoffHours} hours before`,
  });
  return (
    <Card>
      {rows.map((r) => (
        <View key={r.text} style={styles.line}>
          <Icon name={r.icon} color={colors.jade} />
          <Text variant="body" style={styles.flex}>
            {r.text}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/* ─── Glance ─────────────────────────────────────────────── */

/** The few facts worth seeing before scrolling, each only when known. */
export function Glance({ p, kind }: { p: PublicProfile; kind: ProfileKind }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const next = nextFreeLabel(p.nextSlot, lang);
  return (
    <View style={styles.glance}>
      {p.open.state === "open" ? (
        <Badge tone="ok" icon="time-outline" label={ar ? `مفتوح لحد ${time(p.open.closesAt, lang)}` : `Open until ${time(p.open.closesAt, lang)}`} />
      ) : p.open.state === "closed" ? (
        <Badge tone="neutral" icon="time-outline" label={ar ? "مقفول دلوقتي" : "Closed now"} />
      ) : null}
      {next ? <Badge tone="jade" icon="flash-outline" label={next} /> : null}
      {p.autoConfirm ? <Badge tone="info" icon="checkmark-done-outline" label={ar ? "تأكيد فوري" : "Instant confirmation"} /> : null}
      {p.acceptsOnlinePayment ? <Badge tone="neutral" icon="card-outline" label={ar ? "دفع أونلاين" : "Pay online"} /> : null}
      {kind === "dining" && p.branches.length > 1 ? (
        <Badge tone="neutral" icon="business-outline" label={ar ? `${num(p.branches.length, lang)} فروع` : `${p.branches.length} branches`} />
      ) : null}
    </View>
  );
}

/** A tappable photo tile, for galleries. */
export function PhotoTile({ uri, label, onPress, wide }: { uri: string; label: string; onPress: () => void; wide?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <Touchable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={label} style={wide ? styles.photoWide : styles.photo}>
      <Image source={{ uri: sized(uri, wide ? width : width / 2) }} style={StyleSheet.absoluteFill} />
    </Touchable>
  );
}

export function openExternal(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  list: { gap: spacing.md },
  line: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  hoursRow: { flexDirection: "row", paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.xs, borderRadius: radius.xs },
  today: { backgroundColor: colors.jadeTint },
  breakdown: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  map: { marginVertical: spacing.sm },
  average: { alignItems: "center", minWidth: 88 },
  bars: { flex: 1, gap: spacing.xs },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { width: 14, textAlign: "center" },
  barCount: { minWidth: 24 },
  track: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surface3, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.full, backgroundColor: colors.star },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reviewPhotos: { gap: spacing.sm },
  reviewPhoto: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.surface3 },
  team: { gap: spacing.md, paddingVertical: spacing.xxs },
  member: { width: 132, alignItems: "center", gap: spacing.xs },
  provider: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  providerText: { gap: spacing.xxs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  glance: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  photo: { width: 160, height: 120, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface3 },
  photoWide: { width: 260, height: 170, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface3 },
});
