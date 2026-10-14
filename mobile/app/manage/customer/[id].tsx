import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, ErrorState, Icon, SkeletonCard, Text, TopBar, colors, ltr, radius, spacing, useLocale } from "@/design";
import { BookingRow, SectionHead } from "@/features/business/components";
import { useBusinessCustomer } from "@/features/business/queries";
import { telUrl, whatsappUrl } from "@/features/profile/profile";
import { money, num, shortDate } from "@/lib/format";
import { unitFor } from "@/lib/plural";

/**
 * A customer's file, for the owner and managers: how to reach them, what
 * the business noted about them, and every booking with it — newest
 * first. Notes are edited on the web dashboard.
 */
export default function ManageCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const customer = useBusinessCustomer(id ?? "");
  const c = customer.data;

  if (!c) {
    return (
      <View style={styles.page}>
        <TopBar title={T("العميل", "Customer")} back />
        <View style={styles.body}>{customer.isLoading ? <SkeletonCard /> : <ErrorState error={customer.error} onRetry={() => customer.refetch()} />}</View>
      </View>
    );
  }

  const call = telUrl(c.phone);
  const whatsapp = whatsappUrl(c.phone);

  return (
    <View style={styles.page}>
      <TopBar title={c.name} subtitle={c.phone} back />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.actions}>
          {call ? <Button size="sm" variant="outline" icon="call-outline" label={T("اتصل", "Call")} onPress={() => void Linking.openURL(call)} /> : null}
          {whatsapp ? <Button size="sm" variant="outline" icon="logo-whatsapp" label={T("واتساب", "WhatsApp")} onPress={() => void Linking.openURL(whatsapp)} /> : null}
        </View>

        <View style={styles.stats}>
          <Card style={styles.stat}>
            <Text variant="title">{num(c.bookingCount, lang)}</Text>
            <Text variant="caption" tone="subtle">
              {unitFor(c.bookingCount, "booking", lang)}
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Text variant="title">{money(c.totalSpend, c.currency, lang) ?? "—"}</Text>
            <Text variant="caption" tone="subtle">
              {T("إجمالي الصرف", "Total spend")}
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Text variant="title">{c.lastBookingDate ? shortDate(c.lastBookingDate, lang) : "—"}</Text>
            <Text variant="caption" tone="subtle">
              {T("آخر زيارة", "Last visit")}
            </Text>
          </Card>
        </View>

        {c.email ? (
          <Text variant="caption" tone="subtle" style={ltr}>
            {c.email}
          </Text>
        ) : null}

        {c.notes ? (
          <View style={styles.note}>
            <Icon name="document-text-outline" size="sm" color={colors.warn} />
            <Text variant="body" tone="ink2" style={styles.flex}>
              {c.notes}
            </Text>
          </View>
        ) : null}

        <SectionHead title={T("الحجوزات", "Bookings")} />
        {c.bookings.length === 0 ? (
          <Text variant="caption" tone="subtle">
            {T("مفيش حجوزات.", "No bookings.")}
          </Text>
        ) : (
          c.bookings.map((b) => (
            <View key={b.id} style={styles.dated}>
              <Text variant="tiny" tone="subtle">
                {shortDate(b.date, lang)}
              </Text>
              <BookingRow id={b.id} startTime={b.startTime} endTime={b.endTime} customerName={b.serviceName} service={money(b.totalPrice, b.currency, lang) ?? ""} status={b.status} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, gap: spacing.xxs },
  note: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warnSoft },
  dated: { gap: spacing.xxs },
});
