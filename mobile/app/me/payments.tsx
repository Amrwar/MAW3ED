import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Badge, Card, Header, ListState, Screen, Text, colors, spacing, useLocale } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { usePayments } from "@/features/account/queries";
import { Row } from "@/features/booking/components";
import { dateTime, joinParts, longDate, money } from "@/lib/format";

/**
 * Deposits paid, from the payment ledger, with what has been refunded
 * against each — exactly what the ledger records, nothing estimated.
 * Card details are never stored by Maw3ed: deposits are paid on the
 * payment provider's own page.
 */
export default function PaymentsScreen() {
  const { lang } = useLocale();
  return (
    <SignInGate title={lang === "ar" ? "المدفوعات" : "Payments"} reason={lang === "ar" ? "عشان تشوف مدفوعاتك." : "To see your payments."}>
      <Payments />
    </SignInGate>
  );
}

function Payments() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const query = usePayments();
  const list = query.data?.payments ?? [];
  const fmt = (cents: number, currency: string) => money(cents / 100, currency, lang) ?? `${cents / 100} ${currency}`;

  return (
    <Screen scroll={false} edges="both"
      hero={<Header title={T("المدفوعات", "Payments")} back backTo="/(customer)/account" tone="night" />}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.jade} />}
      >
        <Text variant="caption" tone="subtle">
          {T(
            "موعد مش بيحفظ بيانات كروت. لما مكان يطلب عربون، بتدفعه على صفحة الدفع الآمنة وقت الحجز.",
            "Maw3ed never stores card details. When a place asks for a deposit, you pay it on the secure payment page while booking.",
          )}
        </Text>
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={list.length === 0}
          emptyIcon="receipt-outline"
          emptyTitle={T("مفيش مدفوعات", "No payments")}
          emptyBody={T("العرابين اللي بتدفعها بتظهر هنا.", "Deposits you pay will appear here.")}
          onRetry={() => query.refetch()}
        >
          {list.map((p) => {
            const refunded = p.refundedCents > 0;
            return (
              <Card key={p.id}>
                <View style={styles.head}>
                  <Text variant="bodyBold" style={styles.flex}>
                    {(!ar && p.businessEn) || p.businessAr || "—"}
                  </Text>
                  <Badge
                    tone={p.status === "SUCCEEDED" ? "ok" : "info"}
                    label={
                      p.status === "REFUNDED"
                        ? T("اترجّع", "Refunded")
                        : p.status === "PARTIALLY_REFUNDED"
                          ? T("اترجّع جزء", "Partly refunded")
                          : T("مدفوع", "Paid")
                    }
                  />
                </View>
                {(p.serviceAr || p.serviceEn) && p.bookingDate ? (
                  <Text variant="caption" tone="subtle">
                    {joinParts([(!ar && p.serviceEn) || p.serviceAr, longDate(p.bookingDate.slice(0, 10), lang)], lang)}
                  </Text>
                ) : null}
                <Row label={kindLabel(p.kind, T)} value={fmt(p.amountCents, p.currency)} strong />
                {refunded ? <Row label={T("اترجّع", "Refunded")} value={fmt(p.refundedCents, p.currency)} tone="ok" /> : null}
                {p.receiptNumber ? <Row label={T("رقم الإيصال", "Receipt")} value={p.receiptNumber} ltrValue /> : null}
                {p.bookingRef ? <Row label={T("رقم الحجز", "Booking")} value={p.bookingRef} ltrValue /> : null}
                {p.paidAt ? (
                  <Text variant="caption" tone="subtle">
                    {dateTime(p.paidAt, lang)}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
});

/** What the payment was for, from the ledger's kind — not every payment is a deposit. */
function kindLabel(kind: string, T: (ar: string, en: string) => string): string {
  switch (kind) {
    case "BOOKING_BALANCE":
      return T("باقي الحساب", "Balance");
    case "BOOKING_FULL":
      return T("المبلغ كامل", "Full payment");
    case "BOOKING_DEPOSIT":
      return T("العربون", "Deposit");
    default:
      return T("دفعة", "Payment");
  }
}
