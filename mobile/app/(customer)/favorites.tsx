import { RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Text, Button, ListState, colors, spacing } from "@/design";
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
  return (
    <SignInGate title="المحفوظات" reason="عشان تحفظ الأماكن اللي عجبتك وترجعلها بسهولة.">
      <Favorites />
    </SignInGate>
  );
}

function Favorites() {
  const router = useRouter();
  const query = useFavorites();
  const remove = useRemoveFavorite();

  const favorites = query.data?.favorites ?? [];

  return (
    <Screen scroll={false}>
      <Text variant="title">المحفوظات</Text>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.jade}
          />
        }
      >
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={favorites.length === 0}
          emptyTitle="مفيش أماكن محفوظة"
          emptyBody="احفظ الأماكن اللي بتحبها عشان توصلها بسرعة."
          emptyAction={
            <Button label="اتصفح الأماكن" onPress={() => router.push("/(customer)/search")} />
          }
          onRetry={() => query.refetch()}
        >
          <View style={styles.list}>
            {favorites.map((saved) => (
              <BusinessCard
                key={saved.id}
                business={saved}
                trailing={
                  <Button
                    label="شيل"
                    variant="ghost"
                    onPress={() => remove.mutate(saved.id)}
                    // Disabled only while this row's own request is in
                    // flight, so one slow removal does not freeze the
                    // rest of the list.
                    disabled={remove.isPending && remove.variables === saved.id}
                    accessibilityLabel={`شيل ${saved.nameAr} من المحفوظات`}
                  />
                }
              />
            ))}
          </View>
        </ListState>

        {/* The optimistic update already removed the row; this only
            appears if the server then refused and it came back. */}
        {remove.isError ? (
          <Text variant="caption" tone="danger" style={styles.error}>
            ما قدرناش نشيله. جرّب تاني.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  error: { marginTop: spacing.lg, textAlign: "center" },
});
