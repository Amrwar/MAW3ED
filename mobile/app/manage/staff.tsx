import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Select,
  Sheet,
  SkeletonCard,
  Text,
  TextField,
  TopBar,
  colors,
  spacing,
  useLocale,
  useToast,
} from "@/design";
import { useBusinessAccess } from "@/features/business/access";
import { pick, roleLabel } from "@/features/business/components";
import { useSetStaffAccess, useStaff } from "@/features/business/queries";
import type { StaffRow } from "@/features/business/types";
import { ApiError } from "@/lib/api/errors";
import { num } from "@/lib/format";

/**
 * The team: who works here, what they do, and — for the owner — who may
 * sign in to the app, and as what.
 *
 * Giving access is the owner's alone: a phone number and a level. The
 * person signs in with that phone (a one-time code proves it is theirs)
 * and sees the business as a manager or a provider. Taking it away ends
 * their access on their next request. Staff see the team without anyone's
 * phone number.
 */

type Level = "MANAGER" | "PROVIDER" | "NONE";
const DAYS = { ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"], en: ["S", "M", "T", "W", "T", "F", "S"] } as const;

export default function StaffScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const access = useBusinessAccess();
  const staff = useStaff();
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const owner = access.can("staff.manageAccess");

  return (
    <View style={styles.page}>
      <TopBar title={T("الفريق", "Staff")} subtitle={staff.data ? T(`${num(staff.data.length, lang)} شخص`, `${staff.data.length} people`) : undefined} back />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={staff.isRefetching} onRefresh={() => staff.refetch()} tintColor={colors.jade} />}
      >
        {owner ? (
          <Card tone="tint">
            <Text variant="caption" tone="ink2">
              {T(
                "ادّي أي حد في الفريق دخول للتطبيق برقم موبايله: المدير بيشوف كل الحجوزات والعملاء، ومقدّم الخدمة بيشوف حجوزاته بس. التقارير والإعدادات ليك إنت بس.",
                "Give anyone on the team app access with their phone: a manager sees every booking and customer, a provider only their own bookings. Reports and settings stay yours.",
              )}
            </Text>
          </Card>
        ) : null}

        {staff.isLoading ? (
          <SkeletonCard />
        ) : staff.error ? (
          <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
        ) : (staff.data ?? []).length === 0 ? (
          <EmptyState icon="people-outline" title={T("لسه مفيش فريق", "No staff yet")} body={T("ضيف الفريق من لوحة التحكم على الموقع.", "Add your team on the web dashboard.")} />
        ) : (
          (staff.data ?? []).map((m) => (
            <Card key={m.id} style={!m.isActive ? styles.inactive : undefined}>
              <View style={styles.row}>
                <Avatar name={pick(lang, m.nameAr, m.nameEn)} uri={m.photo} size="md" />
                <View style={styles.flex}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {pick(lang, m.nameAr, m.nameEn)}
                    {m.isYou ? T(" (إنت)", " (you)") : ""}
                  </Text>
                  {m.role ? (
                    <Text variant="caption" tone="subtle" numberOfLines={1}>
                      {m.role}
                    </Text>
                  ) : null}
                </View>
                {!m.isActive ? <Badge label={T("موقوف", "Inactive")} tone="neutral" /> : null}
              </View>

              <View style={styles.days} accessibilityLabel={T("أيام الشغل", "Working days")}>
                {DAYS[lang].map((d, i) => (
                  <View key={i} style={[styles.day, m.workingDays.includes(i) && styles.dayOn]}>
                    <Text variant="tiny" style={{ color: m.workingDays.includes(i) ? colors.inverse : colors.subtle }}>
                      {d}
                    </Text>
                  </View>
                ))}
              </View>

              {m.services.length > 0 ? (
                <Text variant="caption" tone="subtle" numberOfLines={2}>
                  {m.services.map((s) => s.service.nameAr).join(" · ")}
                </Text>
              ) : null}

              {owner ? (
                <View style={styles.accessRow}>
                  <View style={styles.flex}>
                    <Text variant="label" tone="ink2">
                      {m.access ? T(`دخول التطبيق: ${roleLabel(m.access, "ar")}`, `App access: ${roleLabel(m.access, "en")}`) : T("من غير دخول للتطبيق", "No app access")}
                    </Text>
                    {m.access ? (
                      <Text variant="caption" tone="subtle">
                        {m.linked ? T("سجّل دخوله", "Signed in") : T("مستني يسجّل دخول بالرقم", "Waiting for them to sign in")}
                      </Text>
                    ) : null}
                  </View>
                  <Button size="sm" variant="outline" label={T("الدخول", "Access")} onPress={() => setEditing(m)} />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      {editing ? <AccessSheet member={editing} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function AccessSheet({ member, onClose }: { member: StaffRow; onClose: () => void }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const toast = useToast();
  const save = useSetStaffAccess();
  const [level, setLevel] = useState<Level>(member.access === "MANAGER" || member.access === "PROVIDER" ? member.access : "NONE");
  const [phone, setPhone] = useState(member.loginPhone ? `+${member.loginPhone}` : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    save.mutate(
      { id: member.id, access: level === "NONE" ? null : level, phone: level === "NONE" ? undefined : phone },
      {
        onSuccess: () => {
          toast({ message: level === "NONE" ? T("اتشال الدخول.", "Access removed.") : T("اتحفظ. يقدر يسجّل دخول بالرقم ده.", "Saved. They can sign in with that number."), tone: "ok" });
          onClose();
        },
        onError: (e) => {
          const code = e instanceof ApiError ? e.code : undefined;
          setError(
            code === "phone-unavailable"
              ? T("الرقم ده مينفعش يتستخدم. اكتب رقم الموظف الشخصي.", "That number can't be used. Enter the person's own mobile.")
              : code === "own-phone"
                ? T("ده رقم النشاط أو رقمك إنت، اكتب رقم الموظف.", "That's the business's or your own number — enter theirs.")
                : code === "phone-invalid"
                    ? T("الرقم مش صحيح. اكتبه بكود الدولة.", "That number isn't valid. Include the country code.")
                    : T("معرفناش نحفظ. جرّب تاني.", "Couldn't save. Try again."),
          );
        },
      },
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={T(`دخول ${member.nameAr} للتطبيق`, `${member.nameEn || member.nameAr}'s app access`)}
      footer={<Button fullWidth label={T("احفظ", "Save")} loading={save.isPending} disabled={level !== "NONE" && phone.trim().length < 8} onPress={submit} />}
    >
      <View style={styles.sheet}>
        <Select<Level>
          label={T("الصلاحية", "Access level")}
          value={level}
          onChange={setLevel}
          options={[
            { value: "MANAGER", label: roleLabel("MANAGER", lang), description: T("كل الحجوزات والعملاء، يأكد ويلغي ويغيّر المواعيد", "Every booking and customer; confirm, cancel, reschedule") },
            { value: "PROVIDER", label: roleLabel("PROVIDER", lang), description: T("حجوزاته بس، ويحدّث حالتها", "Only their own bookings, and their status") },
            { value: "NONE", label: T("من غير دخول", "No access") },
          ]}
        />
        {level !== "NONE" ? (
          <TextField
            label={T("رقم موبايل الموظف", "Their mobile number")}
            hint={T("بكود الدولة، مثلاً ‎+20 10…", "With the country code, e.g. +20 10…")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            ltr
          />
        ) : null}
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  inactive: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  days: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },
  day: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  dayOn: { backgroundColor: colors.night },
  accessRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  sheet: { gap: spacing.lg },
});
