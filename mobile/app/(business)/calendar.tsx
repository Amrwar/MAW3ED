import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  Select,
  SkeletonCard,
  Tabs,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
  useLocale,
} from "@/design";
import { addDays, cairoToday, weekdayOf } from "@/design/calendar";
import { useBusinessAccess } from "@/features/business/access";
import { BookingRow, nameOf, pick } from "@/features/business/components";
import { useBusinessProfile, useCalendar, useStaff } from "@/features/business/queries";
import type { CalendarBooking } from "@/features/business/types";
import { dayOfMonth, longDate, num, weekdayShort } from "@/lib/format";

/**
 * The calendar: a day, or a week, of bookings in time order.
 *
 * Day for running today; week for seeing what is coming. Filters by
 * status, and — for the owner and managers, who see everyone — by staff
 * member and branch. A provider's calendar is their own; the server
 * scopes it, whatever is asked for.
 *
 * Weeks start on Saturday, as Egypt's do.
 */

type Mode = "day" | "week";
const STATUSES = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

function weekStart(iso: string): string {
  // weekdayOf: 0 = Sunday … 6 = Saturday.
  return addDays(iso, -((weekdayOf(iso) + 1) % 7));
}

export default function Calendar() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const access = useBusinessAccess();
  const today = useMemo(() => cairoToday(), []);
  const [mode, setMode] = useState<Mode>("day");
  const [day, setDay] = useState(today);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [staffId, setStaffId] = useState("");
  const [branchId, setBranchId] = useState("");

  const seeAll = access.can("bookings.readAll");
  const staff = useStaff();
  const profile = useBusinessProfile();
  const branches = profile.data?.branches ?? [];

  const from = mode === "day" ? day : weekStart(day);
  const to = mode === "day" ? day : addDays(from, 6);
  const calendar = useCalendar({ dateFrom: from, dateTo: to, status, staffId: seeAll ? staffId : undefined, branchId });
  const rows = useMemo(() => calendar.data?.bookings ?? [], [calendar.data]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i)), [day]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarBooking[]>();
    for (const b of rows) m.set(b.date, [...(m.get(b.date) ?? []), b]);
    return m;
  }, [rows]);

  const statusLabel: Record<(typeof STATUSES)[number], string> = {
    ALL: T("الكل", "All"),
    PENDING: T("مستني تأكيد", "Pending"),
    CONFIRMED: T("مؤكد", "Confirmed"),
    COMPLETED: T("مكتمل", "Completed"),
    CANCELLED: T("ملغي", "Cancelled"),
  };

  const shift = (n: number) => setDay(addDays(day, mode === "day" ? n : n * 7));

  return (
    <Screen
      scroll={false}
      hero={
        <View style={styles.heroBody}>
          <View style={styles.heroTop}>
            <Text variant="display" tone="inverse" accessibilityRole="header" style={styles.flex}>
              {T("التقويم", "Calendar")}
            </Text>
            {day !== today ? (
              <Touchable accessibilityRole="button" onPress={() => setDay(today)} style={styles.todayButton}>
                <Text variant="label" style={{ color: colors.night }}>
                  {T("النهارده", "Today")}
                </Text>
              </Touchable>
            ) : null}
          </View>
          <Tabs
            tone="night"
            value={mode}
            onChange={setMode}
            options={[
              { value: "day", label: T("يوم", "Day") },
              { value: "week", label: T("أسبوع", "Week") },
            ]}
          />
          {/* The week, as a strip: tap a day to see it. */}
          <View style={styles.weekRow}>
            <IconButton icon="chevron-back" variant="night" label={mode === "day" ? T("اليوم اللي فات", "Previous day") : T("الأسبوع اللي فات", "Previous week")} onPress={() => shift(-1)} />
            {week.map((d) => {
              const on = mode === "day" ? d === day : true;
              const count = byDay.get(d)?.length ?? 0;
              return (
                <Touchable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: d === day }}
                  accessibilityLabel={`${longDate(d, lang)}${mode === "week" ? `، ${count}` : ""}`}
                  onPress={() => {
                    setDay(d);
                    setMode("day");
                  }}
                  style={[styles.weekDay, mode === "day" && d === day && styles.weekDayOn, d === today && styles.weekDayToday]}
                >
                  <Text variant="tiny" style={{ color: mode === "day" && on ? colors.night : colors.nightText }}>
                    {weekdayShort(d, lang)}
                  </Text>
                  <Text variant="bodyBold" style={{ color: mode === "day" && on ? colors.night : colors.inverse }}>
                    {dayOfMonth(d, lang)}
                  </Text>
                  {mode === "week" && count > 0 ? (
                    <Text variant="tiny" style={{ color: colors.gold }}>
                      {num(count, lang)}
                    </Text>
                  ) : null}
                </Touchable>
              );
            })}
            <IconButton icon="chevron-forward" variant="night" label={mode === "day" ? T("اليوم اللي جاي", "Next day") : T("الأسبوع اللي جاي", "Next week")} onPress={() => shift(1)} />
          </View>
        </View>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipStrip}>
        {STATUSES.map((s) => (
          <Chip key={s} label={statusLabel[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </ScrollView>

      {(seeAll && (staff.data?.length ?? 0) > 1) || branches.length > 1 ? (
        <View style={styles.filters}>
          {seeAll && (staff.data?.length ?? 0) > 1 ? (
            <View style={styles.flex}>
              <Select
                label={T("الفريق", "Staff")}
                value={staffId}
                onChange={setStaffId}
                options={[{ value: "", label: T("الكل", "Everyone") }, ...(staff.data ?? []).map((m) => ({ value: m.id, label: pick(lang, m.nameAr, m.nameEn) }))]}
              />
            </View>
          ) : null}
          {branches.length > 1 ? (
            <View style={styles.flex}>
              <Select
                label={T("الفرع", "Branch")}
                value={branchId}
                onChange={setBranchId}
                options={[{ value: "", label: T("كل الفروع", "All branches") }, ...branches.map((br) => ({ value: br.id, label: pick(lang, br.nameAr, br.nameEn) }))]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={calendar.isRefetching} onRefresh={() => calendar.refetch()} tintColor={colors.jade} />}
      >
        <Text variant="label" tone="ink2">
          {mode === "day" ? longDate(day, lang) : `${longDate(from, lang)} – ${longDate(to, lang)}`}
        </Text>
        {calendar.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : calendar.error ? (
          <ErrorState error={calendar.error} onRetry={() => calendar.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title={mode === "day" ? T("مفيش حجوزات في اليوم ده", "Nothing on this day") : T("مفيش حجوزات في الأسبوع ده", "Nothing this week")} />
        ) : mode === "day" ? (
          rows.map((b) => <Row key={b.id} b={b} showStaff={seeAll} />)
        ) : (
          week
            .filter((d) => byDay.has(d))
            .map((d) => (
              <View key={d} style={styles.group}>
                <Text variant="heading" accessibilityRole="header">
                  {`${longDate(d, lang)} · ${num(byDay.get(d)!.length, lang)}`}
                </Text>
                {byDay.get(d)!.map((b) => (
                  <Row key={b.id} b={b} showStaff={seeAll} />
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ b, showStaff }: { b: CalendarBooking; showStaff: boolean }) {
  const { lang } = useLocale();
  return (
    <BookingRow
      id={b.id}
      startTime={b.startTime}
      endTime={b.endTime}
      customerName={b.customerName}
      service={pick(lang, b.serviceName, b.serviceNameEn)}
      staff={showStaff ? nameOf(lang, b.staffName ? { nameAr: b.staffName, nameEn: b.staffNameEn } : null) : null}
      branch={b.branchName ? pick(lang, b.branchName, b.branchNameEn) : null}
      status={b.status}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroBody: { gap: spacing.md },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  todayButton: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.gold, justifyContent: "center", overflow: "hidden" },
  weekRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  weekDay: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.md, overflow: "hidden" },
  weekDayOn: { backgroundColor: colors.gold },
  weekDayToday: { borderWidth: 1, borderColor: colors.nightLine },
  chipStrip: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingBottom: spacing.sm },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  group: { gap: spacing.sm, marginBottom: spacing.md },
});
