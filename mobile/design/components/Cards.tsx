import { useState, type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { colors, spacing, type Tone } from "../tokens";
import { useLocale } from "../locale";
import { joinLabel } from "../strings";
import { duration, longDate, money, relativeTime, time } from "@/lib/format";
import { Card } from "./Card";
import { Text } from "./Text";
import { Badge } from "./Badge";
import { Avatar } from "./Avatar";
import { Rating } from "./Rating";
import { Icon } from "./Icon";

/**
 * The product's own cards: a business, a service, a staff member, a
 * booking. Presentational — they take plain values, already in the
 * reader's language, and know nothing about the API. Features map
 * server data onto them.
 *
 * Each card is one control for a screen reader, labelled with a
 * sentence that summarises it, instead of eight text nodes to step
 * through. Absent data is left out, never shown as zero: no rating is
 * "New", no price is no price — the web learned both the hard way.
 */

/* ─── Business ───────────────────────────────────────────── */

export interface BusinessCardProps {
  name: string;
  category: string;
  area: string;
  imageUri?: string | null;
  verified?: boolean;
  rating: number | null;
  ratingCount: number;
  /** From this price; null when nothing is priced. */
  fromPrice?: number | null;
  currency?: string;
  /** null when unknown — then nothing is said. */
  openNow?: boolean | null;
  /** "Next free today 9:00", already in the reader's language; omitted when unknown. */
  nextFree?: string | null;
  /** "2.4 km" from the person, already formatted; only in nearby results. */
  distance?: string | null;
  onPress?: () => void;
  /** A save button, say. Kept out of the card's own tap target. */
  trailing?: ReactNode;
  /** `feature` puts the picture on top, for a highlighted place; `row` is for lists. */
  variant?: "row" | "feature";
}

export function BusinessCard(p: BusinessCardProps) {
  const { lang, t } = useLocale();
  const price = money(p.fromPrice ?? null, p.currency, lang);
  const fromLabel = price ? (lang === "ar" ? `من ${price}` : `from ${price}`) : null;
  const openLabel = p.openNow == null ? null : p.openNow ? (lang === "ar" ? "مفتوح دلوقتي" : "Open now") : lang === "ar" ? "مقفول" : "Closed";
  const label = joinLabel(lang, p.name, p.verified && t("verified"), p.category, p.area, p.distance, fromLabel, openLabel, p.nextFree);
  const where = p.distance ? `${p.category} · ${p.area} · ${p.distance}` : `${p.category} · ${p.area}`;

  const meta = (
    <View style={styles.metaRow}>
      <Rating value={p.rating} count={p.ratingCount} size="sm" />
      {fromLabel ? (
        <Text variant="caption" tone="muted">
          {fromLabel}
        </Text>
      ) : null}
      {openLabel ? (
        <Text variant="tiny" tone={p.openNow ? "ok" : "subtle"}>
          {openLabel}
        </Text>
      ) : null}
      {p.nextFree ? (
        <View style={styles.nextFree}>
          <Icon name="flash-outline" size={13} color={colors.jade} />
          <Text variant="tiny" tone="jade" numberOfLines={1}>
            {p.nextFree}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const title = (
    <View style={styles.titleRow}>
      <Text variant="bodyBold" numberOfLines={1} style={styles.flex}>
        {p.name}
      </Text>
      {p.verified ? <Icon name="checkmark-circle" size="sm" color={colors.jade} /> : null}
    </View>
  );

  if (p.variant === "feature") {
    return (
      <View>
        <Card onPress={p.onPress} accessibilityLabel={label} padded={false}>
          <Cover uri={p.imageUri} name={p.name} />
          <View style={styles.featureBody}>
            {title}
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {where}
            </Text>
            {meta}
          </View>
        </Card>
        {p.trailing ? <View style={styles.featureTrailing}>{p.trailing}</View> : null}
      </View>
    );
  }

  // The trailing control (a save heart) sits beside the card's button,
  // not inside it: a button in a button is invalid on the web and is
  // announced as one control by screen readers.
  return (
    <View>
      <Card onPress={p.onPress} accessibilityLabel={label}>
        <View style={[styles.row, p.trailing ? styles.rowWithTrailing : null]}>
          <Avatar name={p.name} uri={p.imageUri} size="lg" shape="rounded" />
          <View style={styles.flex}>
            {title}
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {where}
            </Text>
            {meta}
          </View>
        </View>
      </Card>
      {p.trailing ? <View style={styles.rowTrailing}>{p.trailing}</View> : null}
    </View>
  );
}

function Cover({ uri, name }: { uri?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.cover, styles.coverFallback]}>
        <Avatar name={name} size="lg" shape="rounded" />
      </View>
    );
  }
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

/* ─── Service ────────────────────────────────────────────── */

export interface ServiceCardProps {
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number | null;
  currency?: string;
  /** "Next free: tomorrow 9:00" — omitted when unknown. */
  nextFree?: string | null;
  selected?: boolean;
  onPress?: () => void;
  actionLabel?: string;
}

export function ServiceCard(p: ServiceCardProps) {
  const { lang } = useLocale();
  const price = money(p.price, p.currency, lang);
  const label = joinLabel(lang, p.name, duration(p.durationMinutes, lang), price, p.nextFree);

  return (
    <Card onPress={p.onPress} accessibilityLabel={label} tone={p.selected ? "tint" : "surface"}>
      <View style={styles.serviceRow}>
        <View style={styles.flex}>
          <Text variant="bodyBold">{p.name}</Text>
          {p.description ? (
            <Text variant="caption" tone="subtle" numberOfLines={2}>
              {p.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Icon name="time-outline" size="sm" color={colors.subtle} />
            <Text variant="caption" tone="muted">
              {duration(p.durationMinutes, lang)}
            </Text>
            {p.nextFree ? (
              <Text variant="caption" tone="jade" numberOfLines={1}>
                · {p.nextFree}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.priceCol}>
          {price ? <Text variant="heading">{price}</Text> : null}
          {p.selected ? <Icon name="checkmark-circle" color={colors.jade} /> : null}
        </View>
      </View>
    </Card>
  );
}

/* ─── Staff ──────────────────────────────────────────────── */

export interface StaffCardProps {
  name: string;
  role?: string | null;
  photoUri?: string | null;
  selected?: boolean;
  onPress?: () => void;
}

/** Compact, for a horizontal row of choices — "with whom". */
export function StaffCard(p: StaffCardProps) {
  const { lang, t } = useLocale();
  return (
    <Card
      onPress={p.onPress}
      accessibilityLabel={joinLabel(lang, p.name, p.role, p.selected && t("selected"))}
      tone={p.selected ? "tint" : "surface"}
      style={styles.staff}
    >
      <Avatar name={p.name} uri={p.photoUri} size="lg" />
      <Text variant="label" align="center" numberOfLines={2}>
        {p.name}
      </Text>
      {p.role ? (
        <Text variant="tiny" tone="subtle" align="center" numberOfLines={1}>
          {p.role}
        </Text>
      ) : null}
    </Card>
  );
}

/* ─── Booking ────────────────────────────────────────────── */

export interface BookingCardProps {
  /** The service, or the customer's name on the owner's side. */
  title: string;
  /** The business, or the service on the owner's side. */
  subtitle?: string | null;
  date: string;
  startTime: string;
  endTime?: string;
  status: { label: string; tone: Tone };
  price?: number | null;
  currency?: string;
  /** From the server, so a phone with the wrong clock cannot misplace it. */
  minutesUntil?: number;
  /** Staff, branch — short facts. */
  meta?: (string | null | undefined)[];
  onPress?: () => void;
  /** Buttons such as reschedule or cancel — small Buttons, kept outside the card's own tap target. */
  actions?: ReactNode;
}

export function BookingCard(p: BookingCardProps) {
  const { lang } = useLocale();
  const when = `${time(p.startTime, lang)}${p.endTime ? ` – ${time(p.endTime, lang)}` : ""}`;
  const relative = p.minutesUntil !== undefined && p.minutesUntil > 0 ? relativeTime(p.minutesUntil, lang) : null;
  const price = money(p.price ?? null, p.currency, lang);
  const facts = (p.meta ?? []).filter(Boolean) as string[];

  return (
    <View>
      <Card
        onPress={p.onPress}
        accessibilityLabel={joinLabel(lang, p.title, p.subtitle, p.status.label, longDate(p.date, lang), when, relative, price, ...facts)}
      >
        <View style={styles.bookingHead}>
          <View style={styles.flex}>
            <Text variant="bodyBold" numberOfLines={1}>
              {p.title}
            </Text>
            {p.subtitle ? (
              <Text variant="caption" tone="subtle" numberOfLines={1}>
                {p.subtitle}
              </Text>
            ) : null}
          </View>
          <Badge label={p.status.label} tone={p.status.tone} />
        </View>

        <View style={styles.when}>
          <Icon name="calendar-outline" size="sm" color={colors.jade} />
          <Text variant="label">{longDate(p.date, lang)}</Text>
        </View>
        <View style={styles.when}>
          <Icon name="time-outline" size="sm" color={colors.jade} />
          {/* The locale's own direction: forcing LTR here read "ص 10:30 – ص 10:00" in Arabic. */}
          <Text variant="label">{when}</Text>
          {relative ? (
            <Text variant="caption" tone="jade">
              · {relative}
            </Text>
          ) : null}
        </View>

        {facts.length > 0 || price ? (
          <View style={styles.footer}>
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
              {facts.join(" · ")}
            </Text>
            {price ? <Text variant="label">{price}</Text> : null}
          </View>
        ) : null}
      </Card>
      {p.actions ? <View style={styles.actions}>{p.actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  nextFree: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surface3 },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.jadeTint },
  featureBody: { padding: spacing.lg, gap: spacing.xxs },
  rowWithTrailing: { paddingEnd: 44 },
  rowTrailing: { position: "absolute", top: 0, bottom: 0, end: spacing.sm, justifyContent: "center" },
  featureTrailing: { position: "absolute", top: spacing.sm, end: spacing.sm },
  serviceRow: { flexDirection: "row", gap: spacing.md },
  priceCol: { alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  staff: { width: 112, alignItems: "center", gap: spacing.xs },
  bookingHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.sm },
  when: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
});
