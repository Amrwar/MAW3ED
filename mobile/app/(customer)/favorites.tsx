import { RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Screen, Text, Button, IconButton, ListState, colors, spacing, useLocale } from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { useFavorites, useRemoveFavorite } from "@/features/customer/queries";
import { SignInGate } from "@/features/auth/SignInGate";

/**
 * Saved places.
 *
 * Removing is optimistic — the row goes immediately and comes back if
 * the server refuses. Unsaving is reversible and low-stakes, which is
 * exactly when optimism is right; confirming a booking is not, and that
 * one waits for the server.
 */
export default function FavoritesScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <SignInGate
      title={ar ? "المحفوظات" : "Favorites"}
      reason={ar ? "عشان تحفظ الأماكن اللي عجبتك وترجعلها بسهولة." : "To save the places you like and find them again easily."}
    >
      <Favorites />
    </SignInGate>
  );
}

function Favorites() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const query = useFavorites();
  const remove = useRemoveFavorite();

  const favorites = query.data?.favorites ?? [];

  return (
    <Screen
      scroll={false}
      hero={
        <>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            {T("المحفوظات", "Favorites")}
          </Text>
          <Text variant="body" tone="inverseMuted">
            {T("الأماكن اللي حفظتها، في مكان واحد.", "The places you saved, in one place.")}
          </Text>
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.jade} />
        }
      >
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={favorites.length === 0}
          emptyTitle={T("مفيش أماكن محفوظة", "Nothing saved yet")}
          emptyBody={T("دوس على القلب في أي مكان عشان تحفظه هنا.", "Tap the heart on any place to keep it here.")}
          emptyIcon="heart-outline"
          emptyAction={<Button label={T("اتصفح الأماكن", "Browse places")} onPress={() => router.push("/(customer)/search")} />}
          onRetry={() => query.refetch()}
        >
          <View style={styles.list}>
            {favorites.map((saved) => {
              const name = (!ar && saved.nameEn) || saved.nameAr;
              return (
                <BusinessCard
                  key={saved.id}
                  business={saved}
                  onPress={() => router.push({ pathname: "/business/[slug]", params: { slug: saved.slug } })}
                  trailing={
                    // A filled heart, the same size as the save heart in
                    // search: a worded button was too wide for the card.
                    <IconButton
                      icon="heart"
                      color={colors.danger}
                      label={T(`شيل ${name} من المحفوظات`, `Remove ${name} from favorites`)}
                      onPress={() => remove.mutate(saved.id)}
                      // Disabled only while this row's own request is in
                      // flight, so one slow removal does not freeze the
                      // rest of the list.
                      disabled={remove.isPending && remove.variables === saved.id}
                    />
                  }
                />
              );
            })}
          </View>
        </ListState>

        {/* The optimistic update already removed the row; this only
            appears if the server then refused and it came back. */}
        {remove.isError ? (
          <Text variant="caption" tone="danger" align="center" style={styles.error}>
            {T("ما قدرناش نشيله. جرّب تاني.", "Couldn't remove it. Try again.")}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  error: { marginTop: spacing.lg },
});
