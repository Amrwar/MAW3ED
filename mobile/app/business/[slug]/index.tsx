import { useMemo, useRef, useState, type ReactNode } from "react";
import { Image, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
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
  Touchable,
  colors,
  radius,
  spacing,
  useLocale,
  useToast,
} from "@/design";
import { FavoriteButton } from "@/features/discovery/FavoriteButton";
import { useBusinessProfile } from "@/features/discovery/queries";
import { PhotoViewer } from "@/features/profile/PhotoViewer";
import {
  KIND_WORDS,
  profileKind,
  profileUrl,
  seating,
  specialties,
  telUrl,
  whatsappUrl,
  type ProfileKind,
} from "@/features/profile/profile";
import {
  Glance,
  HoursTable,
  LocationCard,
  PhotoTile,
  PolicyList,
  ProviderList,
  RatingBreakdown,
  ReviewItem,
  SeatingCard,
  Section,
  TeamStrip,
  openExternal,
} from "@/features/profile/sections";
import { ServiceSheet, StaffSheet, type BookingChoice } from "@/features/profile/sheets";
import { ApiError } from "@/lib/api/errors";
import { money, num } from "@/lib/format";
import type { PublicProfile, PublicStaffMember } from "@/types/api";

/**
 * One business.
 *
 * Everything shown is what GET /api/public/[slug] returned, and anything
 * missing is left out rather than filled in: no reviews says so, an
 * unpriced service shows no price, hours never set show nothing.
 *
 * Not every business gets the same page (features/profile/profile.ts):
 * a clinic leads with its doctors and what they treat, a salon with its
 * team and when each is free, a restaurant with its tables and branches.
 *
 * Booking opens the app's own flow (app/book/[slug].tsx) on the service
 * and person chosen here.
 */

type Service = PublicProfile["services"][number];

/** Reviews on the profile itself; the rest are behind "All". */
const SHOWN_REVIEWS = 3;

export default function BusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const profile = useBusinessProfile(slug);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(customer)"));

  if (profile.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]} accessibilityLabel={ar ? "بيحمّل" : "Loading"}>
        <Skeleton height={220} radius={0} />
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
  const toast = useToast();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const name = (!ar && p.nameEn) || p.nameAr;
  const kind = profileKind(p);
  const words = KIND_WORDS[kind];
  const place = [p.neighborhood && (ar ? p.neighborhood.nameAr : p.neighborhood.nameEn), ar ? p.city.nameAr : p.city.nameEn]
    .filter(Boolean)
    .join(ar ? "، " : ", ");

  const scroll = useRef<ScrollView>(null);
  // Where the services list sits in the scroll: its offset inside the
  // body, plus the body's own offset under the cover.
  const bodyY = useRef(0);
  const servicesY = useRef<number | null>(null);
  const [compact, setCompact] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [service, setService] = useState<{ s: Service; staffId: string | null } | null>(null);
  const [member, setMember] = useState<PublicStaffMember | null>(null);

  // The cover leads the gallery when it is not already one of its photos.
  const photos = useMemo(() => {
    const list = p.images.map((i) => ({ url: i.url, caption: i.caption }));
    if (p.coverImage && !list.some((i) => i.url === p.coverImage)) list.unshift({ url: p.coverImage, caption: null });
    return list;
  }, [p.images, p.coverImage]);

  const tags = kind === "clinic" ? specialties(p.staff) : [];
  const tables = kind === "dining" ? seating(p.resources) : null;

  /** Into the app's own booking flow, on whatever was chosen here. */
  const book = (choice: BookingChoice | null) => {
    setService(null);
    const params: Record<string, string> = { slug: p.slug };
    if (choice?.serviceId) params.service = choice.serviceId;
    if (choice?.serviceId && choice.staffId) params.staff = choice.staffId;
    router.push({ pathname: "/book/[slug]", params });
  };

  /** The sticky button: one service opens its sheet; several start booking at the choice of service. */
  const onBookPress = () => {
    const only = p.services.length === 1 ? p.services[0] : undefined;
    if (only) {
      setService({ s: only, staffId: null });
      return;
    }
    book(null);
  };

  const share = async () => {
    const url = profileUrl(p.slug);
    const message = T(`${name} على مواعيد: ${url}`, `${name} on Maw3ed: ${url}`);
    try {
      if (Platform.OS === "web") {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) await nav.share({ title: name, url });
        else if (nav?.clipboard) {
          await nav.clipboard.writeText(url);
          toast({ message: T("اتنسخ اللينك", "Link copied"), tone: "ok" });
        }
        return;
      }
      await Share.share(Platform.OS === "ios" ? { message: name, url } : { message, title: name });
    } catch {
      // Dismissing the share sheet is not an error worth a message.
    }
  };

  /* ── Sections, each only with real data ── */

  const servicesSection =
    p.services.length > 0 ? (
      <View
        key="services"
        onLayout={(e) => {
          servicesY.current = e.nativeEvent.layout.y;
        }}
      >
        <Section title={words.services[lang]} testID="services">
          {p.services.map((s) => (
            <ServiceCard
              key={s.id}
              name={(!ar && s.nameEn) || s.nameAr}
              description={ar ? s.descriptionAr : null}
              durationMinutes={s.durationMinutes}
              price={s.price}
              currency={s.currency}
              onPress={() => setService({ s, staffId: null })}
            />
          ))}
        </Section>
      </View>
    ) : null;

  const peopleSection =
    p.staff.length > 0 && kind !== "dining" ? (
      <Section key="people" title={words.people[lang]} testID="people">
        {kind === "clinic" ? (
          <ProviderList staff={p.staff} onOpen={setMember} />
        ) : (
          <TeamStrip staff={p.staff} onOpen={setMember} />
        )}
      </Section>
    ) : null;

  const diningSection =
    kind === "dining" && tables ? (
      <Section key="dining" title={T("الترابيزات", "Seating")} testID="seating">
        <SeatingCard seating={tables} />
      </Section>
    ) : null;

  // A gallery only when there is one: a cover alone is already on screen.
  const photosSection =
    p.images.length > 0 ? (
      <Section
        key="photos"
        title={T("صور", "Photos")}
        action={
          photos.length > 1 ? (
            <Button size="sm" variant="ghost" label={T(`الكل (${num(photos.length, lang)})`, `All (${photos.length})`)} onPress={() => setViewerAt(0)} />
          ) : undefined
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          {photos.map((ph, i) => (
            <PhotoTile
              key={`${i}:${ph.url}`}
              uri={ph.url}
              wide={kind === "dining"}
              label={ph.caption ?? T(`صورة ${num(i + 1, lang)} من ${num(photos.length, lang)}`, `Photo ${i + 1} of ${photos.length}`)}
              onPress={() => setViewerAt(i)}
            />
          ))}
        </ScrollView>
      </Section>
    ) : null;

  const aboutSection = p.about?.trim() ? (
    <Section key="about" title={T("عن المكان", "About")}>
      <About text={p.about.trim()} />
    </Section>
  ) : null;

  const hoursSection =
    p.hours.length > 0 ? (
      <Section key="hours" title={T("مواعيد العمل", "Opening hours")}>
        <HoursTable hours={p.hours} />
      </Section>
    ) : null;

  const locationSection = (
    <Section key="location" title={p.branches.length > 0 ? T("العنوان والفروع", "Location & branches") : T("العنوان", "Location")} testID="location">
      <LocationCard p={p} onOpenUrl={openExternal} />
    </Section>
  );

  const reviewsSection = (
    <Section
      key="reviews"
      title={T("التقييمات", "Reviews")}
      testID="reviews"
      action={
        p.rating.count > SHOWN_REVIEWS ? (
          <Button
            size="sm"
            variant="ghost"
            label={T(`الكل (${num(p.rating.count, lang)})`, `All (${p.rating.count})`)}
            onPress={() => router.push({ pathname: "/business/[slug]/reviews", params: { slug: p.slug } })}
          />
        ) : undefined
      }
    >
      {p.rating.count > 0 ? (
        <>
          <RatingBreakdown rating={p.rating} />
          {p.reviews.slice(0, SHOWN_REVIEWS).map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </>
      ) : (
        <Card tone="tint">
          <Text variant="body" tone="muted">
            {T("لسه مفيش تقييمات. التقييمات بتيجي من ناس حجزوا وراحوا فعلاً.", "No reviews yet. Reviews come only from people who booked and went.")}
          </Text>
        </Card>
      )}
    </Section>
  );

  const policiesSection = (
    <Section key="policies" title={T("سياسة الحجز", "Booking policy")} testID="policies">
      <PolicyList policies={p.policies} autoConfirm={p.autoConfirm} />
    </Section>
  );

  const contactSection = <Contact key="contact" p={p} />;

  const order: Record<ProfileKind, (ReactNode | null)[]> = {
    clinic: [peopleSection, servicesSection, hoursSection, locationSection, aboutSection, reviewsSection, policiesSection, photosSection, contactSection],
    team: [peopleSection, servicesSection, photosSection, reviewsSection, hoursSection, locationSection, policiesSection, aboutSection, contactSection],
    dining: [photosSection, diningSection, servicesSection, hoursSection, locationSection, reviewsSection, aboutSection, policiesSection, contactSection],
    general: [servicesSection, aboutSection, photosSection, hoursSection, locationSection, reviewsSection, policiesSection, peopleSection, contactSection],
  };

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 170;
          if (past !== compact) setCompact(past);
        }}
        scrollEventThrottle={32}
      >
        {/* ── Cover ── */}
        <Cover uri={p.coverImage} count={photos.length} onOpen={photos.length > 0 ? () => setViewerAt(0) : undefined} />

        <View
          style={styles.body}
          onLayout={(e) => {
            bodyY.current = e.nativeEvent.layout.y;
          }}
        >
          {/* ── Identity ── */}
          <View style={styles.identity}>
            <View style={styles.logo}>
              <Avatar name={name} uri={p.logoImage} size="xl" shape="rounded" />
            </View>
            <View style={styles.titleRow}>
              <Text variant="title" accessibilityRole="header" style={styles.flex}>
                {name}
              </Text>
            </View>
            <View style={styles.meta}>
              {p.isVerified ? <Badge tone="jade" icon="checkmark-circle" label={T("موثّق", "Verified")} /> : null}
              <Text variant="body" tone="muted" style={styles.flex}>
                {(ar ? p.category.nameAr : p.category.nameEn) + " · " + place}
              </Text>
            </View>
            {p.taglineAr && ar ? (
              <Text variant="body" tone="ink2">
                {p.taglineAr}
              </Text>
            ) : null}
            <Rating value={p.rating.average} count={p.rating.count} />
            {tags.length > 0 ? (
              <View style={styles.tags} accessibilityLabel={T("التخصصات", "Specialties")}>
                {tags.slice(0, 6).map((t) => (
                  <Badge key={t} label={t} tone="neutral" icon="medkit-outline" />
                ))}
                {tags.length > 6 ? <Badge label={`+${num(tags.length - 6, lang)}`} tone="neutral" /> : null}
              </View>
            ) : null}
          </View>

          <Glance p={p} kind={kind} />

          {order[kind]}
        </View>
      </ScrollView>

      {/* ── Over the cover, then a solid bar once it scrolls away ── */}
      <View
        style={[styles.topBar, styles.floating, { paddingTop: insets.top + spacing.sm }, compact && styles.topBarSolid]}
        pointerEvents="box-none"
      >
        <IconButton icon="chevron-back" label={T("رجوع", "Back")} onPress={onBack} variant="filled" />
        {compact ? (
          <Text variant="bodyBold" numberOfLines={1} style={[styles.flex, styles.compactTitle]}>
            {name}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        <View style={styles.actions}>
          <IconButton icon="share-social-outline" label={T(`شارك ${name}`, `Share ${name}`)} onPress={share} variant="filled" />
          <View style={styles.filled}>
            <FavoriteButton businessId={p.id} name={name} />
          </View>
        </View>
      </View>

      {/* ── Always in reach ── */}
      <View style={[styles.bookBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {p.services.length > 0 ? (
          <>
            <View style={styles.flex}>
              {p.minPrice !== null ? (
                <>
                  <Text variant="caption" tone="subtle">
                    {T("الأسعار تبدأ من", "Prices from")}
                  </Text>
                  <Text variant="heading">{money(p.minPrice, p.currency, lang)}</Text>
                </>
              ) : (
                <Text variant="caption" tone="subtle">
                  {p.services.length === 1 && p.services[0]
                    ? (!ar && p.services[0].nameEn) || p.services[0].nameAr
                    : T(`${num(p.services.length, lang)} خدمات`, `${p.services.length} services`)}
                </Text>
              )}
            </View>
            <Button
              label={words.book[lang]}
              icon="calendar-outline"
              onPress={onBookPress}
              accessibilityHint={p.services.length === 1 ? T("بيفتح تفاصيل الخدمة", "Opens the service") : T("بيبدأ الحجز من اختيار الخدمة", "Starts booking with a choice of service")}
            />
          </>
        ) : (
          <Text variant="body" tone="muted" style={styles.flex}>
            {T("المكان لسه ماضافش خدمات تتحجز. تقدر تتواصل معاهم.", "Nothing to book here yet. You can still contact them.")}
          </Text>
        )}
      </View>

      <PhotoViewer photos={photos} start={viewerAt} onClose={() => setViewerAt(null)} />
      <ServiceSheet
        service={service?.s ?? null}
        initialStaffId={service?.staffId ?? null}
        p={p}
        kind={kind}
        onClose={() => setService(null)}
        onBook={book}
      />
      <StaffSheet
        member={member}
        p={p}
        kind={kind}
        onClose={() => setMember(null)}
        onPickService={(s, m) => {
          setMember(null);
          setService({ s, staffId: m.id });
        }}
      />
    </View>
  );
}

function Cover({ uri, count, onOpen }: { uri: string | null; count: number; onOpen?: () => void }) {
  const { lang } = useLocale();
  const [failed, setFailed] = useState(false);
  const image =
    !uri || failed ? (
      <View style={[styles.cover, styles.coverFallback]} />
    ) : (
      <Image source={{ uri }} style={styles.cover} onError={() => setFailed(true)} accessibilityElementsHidden importantForAccessibility="no" />
    );
  if (!onOpen) return image;
  return (
    <Touchable onPress={onOpen} accessibilityRole="button" accessibilityLabel={lang === "ar" ? `شوف الصور (${num(count, lang)})` : `View photos (${count})`}>
      {image}
      <View style={styles.photoCount}>
        <Icon name="images-outline" color={colors.inverse} size="sm" />
        <Text variant="tiny" tone="inverse">
          {num(count, lang)}
        </Text>
      </View>
    </Touchable>
  );
}

/** Long descriptions fold to five lines, with a way to open them. */
function About({ text }: { text: string }) {
  const { lang } = useLocale();
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <View style={styles.about}>
      <Text variant="body" tone="ink2" numberOfLines={long && !open ? 5 : undefined}>
        {text}
      </Text>
      {long ? (
        <Button
          size="sm"
          variant="ghost"
          label={open ? (lang === "ar" ? "أقل" : "Show less") : lang === "ar" ? "اقرأ أكتر" : "Read more"}
          onPress={() => setOpen((v) => !v)}
        />
      ) : null}
    </View>
  );
}

function Contact({ p }: { p: PublicProfile }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const wa = p.whatsapp ? whatsappUrl(p.whatsapp) : null;
  const tel = p.phone ? telUrl(p.phone) : null;
  if (!wa && !tel) return null;
  return (
    <Section title={ar ? "تواصل" : "Contact"}>
      <View style={styles.contact}>
        {wa ? (
          <Button label={ar ? "واتساب" : "WhatsApp"} icon="logo-whatsapp" variant="outline" onPress={() => openExternal(wa)} style={styles.flex} />
        ) : null}
        {tel ? <Button label={ar ? "اتصال" : "Call"} icon="call-outline" variant="outline" onPress={() => openExternal(tel)} style={styles.flex} /> : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  centre: { justifyContent: "center" },
  flex: { flex: 1 },
  cover: { width: "100%", height: 240, backgroundColor: colors.surface3 },
  // No cover: a short band, not 240pt of nothing — the logo and name carry it.
  coverFallback: { backgroundColor: colors.night, height: 150 },
  photoCount: {
    position: "absolute",
    bottom: spacing.md,
    end: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    // Solid, not translucent: white text over an unknown photo must read on any of them.
    backgroundColor: colors.night,
  },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  topBarSolid: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm },
  floating: { position: "absolute", top: 0, start: 0, end: 0 },
  compactTitle: { marginHorizontal: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  filled: { backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  identity: { gap: spacing.xs, marginTop: -44 },
  logo: { alignSelf: "flex-start", borderRadius: radius.lg, borderWidth: 3, borderColor: colors.ground, backgroundColor: colors.surface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  gallery: { gap: spacing.sm },
  about: { gap: spacing.xs, alignItems: "flex-start" },
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
