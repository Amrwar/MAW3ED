import { useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Chip, EmptyState, ErrorState, Loading, SkeletonCard, Text, TopBar, colors, spacing, useLocale } from "@/design";
import { useBusinessProfile } from "@/features/discovery/queries";
import { useBusinessReviews, type ReviewSort } from "@/features/profile/queries";
import { RatingBreakdown, ReviewItem } from "@/features/profile/sections";
import { num } from "@/lib/format";

/**
 * Every review for one business: sorted, filtered by stars, ten at a
 * time. Opened from the profile's "All"; the breakdown at the top is the
 * profile's own, already loaded.
 */

const SORTS: { value: ReviewSort; ar: string; en: string }[] = [
  { value: "recent", ar: "الأحدث", en: "Newest" },
  { value: "highest", ar: "الأعلى", en: "Highest" },
  { value: "lowest", ar: "الأقل", en: "Lowest" },
  { value: "helpful", ar: "الأكتر إفادة", en: "Most helpful" },
];

export default function ReviewsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [stars, setStars] = useState<number | null>(null);
  const profile = useBusinessProfile(slug);
  const reviews = useBusinessReviews(slug ?? "", sort, stars);

  const rows = reviews.data?.pages.flatMap((pg) => pg.reviews) ?? [];
  const matched = reviews.data?.pages[0]?.matched ?? 0;
  const name = profile.data ? (!ar && profile.data.nameEn) || profile.data.nameAr : "";
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/business/[slug]", params: { slug: slug ?? "" } }));

  return (
    <View style={styles.page}>
      <TopBar title={ar ? "التقييمات" : "Reviews"} subtitle={name || undefined} back onBack={back} />

      <FlatList
        // A new sort or filter is a new list, from the top.
        key={`${sort}:${stars ?? 0}`}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        renderItem={({ item }) => <ReviewItem review={item} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (reviews.hasNextPage && !reviews.isFetchingNextPage && !reviews.isFetchNextPageError) reviews.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.head}>
            {profile.data ? <RatingBreakdown rating={profile.data.rating} /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SORTS.map((s) => (
                <Chip key={s.value} label={ar ? s.ar : s.en} selected={sort === s.value} onPress={() => setSort(s.value)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={ar ? "كل النجوم" : "All stars"} selected={stars === null} onPress={() => setStars(null)} />
              {[5, 4, 3, 2, 1].map((n) => (
                <Chip
                  key={n}
                  label={`${num(n, lang)} ★`}
                  count={profile.data?.rating.distribution[String(n) as "1"]}
                  selected={stars === n}
                  onPress={() => setStars(stars === n ? null : n)}
                />
              ))}
            </ScrollView>
            {reviews.isSuccess && matched > 0 ? (
              <Text variant="caption" tone="subtle">
                {ar ? `${num(matched, lang)} تقييم` : `${matched} ${matched === 1 ? "review" : "reviews"}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          reviews.isLoading ? (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : reviews.isError ? (
            <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
          ) : (
            <EmptyState
              icon="star-outline"
              title={stars ? (ar ? "مفيش تقييمات بالعدد ده من النجوم" : "No reviews with that many stars") : ar ? "لسه مفيش تقييمات" : "No reviews yet"}
              action={stars ? <Button label={ar ? "كل النجوم" : "All stars"} variant="outline" onPress={() => setStars(null)} /> : undefined}
            />
          )
        }
        ListFooterComponent={
          rows.length === 0 ? null : reviews.isFetchingNextPage ? (
            <Loading />
          ) : reviews.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text variant="caption" tone="danger" align="center">
                {ar ? "ما قدرناش نجيب الباقي." : "Couldn't load more."}
              </Text>
              <Button label={ar ? "جرّب تاني" : "Try again"} variant="outline" size="sm" onPress={() => reviews.fetchNextPage()} />
            </View>
          ) : !reviews.hasNextPage ? (
            <Text variant="caption" tone="subtle" align="center" style={styles.end}>
              {ar ? "دي كل التقييمات" : "That's every review"}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  chips: { gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  footer: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.lg },
  end: { paddingVertical: spacing.lg },
});
