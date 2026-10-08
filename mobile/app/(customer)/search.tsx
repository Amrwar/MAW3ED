import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, TextInput, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Typography";
import { ListState } from "@/components/ui/ListState";
import { BusinessCard } from "@/components/business/BusinessCard";
import { useBusinesses } from "@/hooks/useCustomerData";
import { num } from "@/lib/format";
import { colors, radius, spacing, touchTarget } from "@/constants/theme";

/**
 * Search.
 *
 * A FlatList rather than the usual Screen, because this is the one
 * screen that can show hundreds of rows and nesting a list inside a
 * ScrollView throws away its virtualisation — the symptom being a list
 * that scrolls fine with five results and stutters with two hundred.
 * The search field rides along as the list header so it scrolls with
 * the results instead of pinning a bar over a short list.
 */
export default function Search() {
  const params = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();

  const [term, setTerm] = useState(params.q ?? "");
  const [query, setQuery] = useState(params.q ?? "");

  // Debounced: typing "barber" would otherwise be six requests, five of
  // them already stale by the time they land.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useBusinesses({ q: query });
  const businesses = results.data?.businesses ?? [];

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.ground }]}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: spacing.xxl,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      data={businesses}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="title">ابحث</Text>
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="اسم المكان أو الخدمة"
            placeholderTextColor={colors.faint}
            style={styles.input}
            returnKeyType="search"
            // Keeps the field clear of autocorrect suggestions that
            // fight with Arabic input.
            autoCorrect={false}
            accessibilityLabel="ابحث عن مكان"
            // Submitting skips the debounce for somebody who typed the
            // whole thing and pressed search.
            onSubmitEditing={() => setQuery(term)}
          />
          {!results.isLoading && results.data ? (
            <Text variant="caption" tone="subtle" style={styles.count}>
              {/* The real total from the server, not the page length. */}
              {num(results.data.total)} نتيجة
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <ListState
          loading={results.isLoading}
          error={results.error}
          isEmpty
          emptyTitle={query ? "مفيش نتايج" : "ابدأ البحث"}
          emptyBody={
            query
              ? "جرّب كلمة تانية، أو امسح البحث عشان تشوف كل الأماكن."
              : "اكتب اسم مكان أو خدمة فوق."
          }
          onRetry={() => results.refetch()}
        >
          <></>
        </ListState>
      }
      renderItem={({ item }) => <BusinessCard business={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: { marginBottom: spacing.lg, gap: spacing.md },
  input: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  count: { marginTop: spacing.xs },
});
