import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import {
  Avatar,
  Badge,
  BookingCard,
  BusinessCard,
  Button,
  Calendar,
  Card,
  Chip,
  ConfirmDialog,
  DateStrip,
  Dialog,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Loading,
  Rating,
  RatingInput,
  Screen,
  SearchField,
  Select,
  ServiceCard,
  Sheet,
  SkeletonCard,
  StaffCard,
  Tabs,
  Text,
  TextField,
  TimeSlots,
  colors,
  elevation,
  radius,
  spacing,
  tones,
  typography,
  useLayout,
  useLocale,
  useToast,
  type IconName,
  type Tone,
} from "@/design";
import { addDays, cairoToday } from "@/design/calendar";
import { config } from "@/lib/config";
import { NetworkError } from "@/lib/api/errors";

/**
 * Every component in the design system, on one screen, in the language
 * chosen at the top — switch it and the whole app, not just this page,
 * re-lays out, which is the point: RTL is structural, not per screen.
 *
 * Development and staging builds only. A production build redirects
 * home, so nobody stumbles on it.
 */
export default function DesignSystem() {
  if (config.appEnv === "production") return <Redirect href="/" />;
  return <Showcase />;
}

const SAMPLE_PHOTO = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=70";

function Showcase() {
  const { lang, setLang } = useLocale();
  const { columns, isTablet } = useLayout();
  const toast = useToast();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [chips, setChips] = useState<string[]>(["salons"]);
  const [select, setSelect] = useState<"any" | "sara" | "omar" | null>(null);
  const [stars, setStars] = useState(4);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>("10:30");
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const today = cairoToday();
  const closedFridays = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() !== 5;
  const grid = { flexBasis: `${Math.floor(100 / columns) - 2}%` as const, flexGrow: 1 };

  return (
    <Screen edges="both">
      <Header
        back
        large
        title={T("نظام التصميم", "Design system")}
        subtitle={T("موعد · للمطورين فقط", "Maw3ed · development only")}
      />
      <Tabs
        options={[
          { value: "ar", label: "العربية" },
          { value: "en", label: "English" },
        ]}
        value={lang}
        onChange={setLang}
      />

      {/* ── Colour ── */}
      <Section title={T("الألوان", "Colour")} note={T("Deep Anchor: الليل يفتح ويقفل، المحتوى على الفاتح، والجاد لون واحد للفعل.", "Deep Anchor: night opens and closes, content sits on light, jade is the one accent for action.")}>
        <View style={styles.anchor}>
          <Text variant="heading" tone="inverse">
            {T("الليل — المرساة", "Night — the anchor")}
          </Text>
          <View style={styles.swatchRow}>
            {(["night", "night2", "nightLine", "nightText", "nightAccent"] as const).map((c) => (
              <Swatch key={c} name={c} dark />
            ))}
          </View>
        </View>
        <View style={styles.swatchRow}>
          {(["ground", "surface", "surface2", "surface3", "line", "line2", "ink", "ink2", "muted", "subtle", "faint", "jade", "jadeSoft", "jadeTint", "star"] as const).map((c) => (
            <Swatch key={c} name={c} />
          ))}
        </View>
        <View style={styles.wrapRow}>
          {(Object.keys(tones) as Tone[]).map((t) => (
            <Badge key={t} tone={t} label={t} />
          ))}
        </View>
      </Section>

      {/* ── Type ── */}
      <Section title={T("الخط", "Type")} note="Readex Pro — العربية واللاتينية بخط واحد">
        {(Object.keys(typography) as (keyof typeof typography)[]).map((v) => (
          <Text key={v} variant={v}>
            {v} · {T("احجز موعدك في ثواني", "Book in seconds")}
          </Text>
        ))}
      </Section>

      {/* ── Space, radius, elevation ── */}
      <Section title={T("المسافات والحواف والظلال", "Space, radius, elevation")}>
        <View style={styles.wrapRow}>
          {(Object.keys(spacing) as (keyof typeof spacing)[]).map((k) => (
            <View key={k} style={styles.spaceSample}>
              <View style={{ width: spacing[k], height: spacing[k], backgroundColor: colors.jade }} />
              <Text variant="tiny" tone="subtle">
                {k} {spacing[k]}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.wrapRow}>
          {(["xs", "sm", "md", "lg", "xl"] as const).map((k) => (
            <View key={k} style={[styles.radiusSample, { borderRadius: radius[k] }]}>
              <Text variant="tiny" tone="subtle" align="center">
                {k}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.wrapRow}>
          {(["card", "raised", "float"] as const).map((k) => (
            <View key={k} style={[styles.elevSample, elevation[k]]}>
              <Text variant="tiny" tone="subtle" align="center">
                {k}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ── Icons ── */}
      <Section title={T("الأيقونات", "Icons")} note={T("الأسهم بتنعكس في العربي، الأشياء لا.", "Arrows mirror in Arabic; objects never do.")}>
        <View style={styles.wrapRow}>
          {(["chevron-forward", "arrow-forward", "chevron-back", "calendar-outline", "time-outline", "heart-outline", "notifications-outline", "search", "star", "location-outline", "call-outline", "logo-whatsapp"] as IconName[]).map((n) => (
            <View key={n} style={styles.iconCell}>
              <Icon name={n} color={colors.ink} />
              <Text variant="tiny" tone="subtle" numberOfLines={1}>
                {n.replace("-outline", "")}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ── Buttons ── */}
      <Section title={T("الأزرار", "Buttons")}>
        <Button label={T("احجز موعد", "Book now")} icon="calendar" fullWidth />
        <View style={styles.wrapRow}>
          <Button label={T("ثانوي", "Secondary")} variant="secondary" />
          <Button label={T("محدد", "Outline")} variant="outline" />
          <Button label={T("بسيط", "Ghost")} variant="ghost" />
          <Button label={T("حذف", "Delete")} variant="danger" icon="trash-outline" />
        </View>
        <View style={styles.wrapRow}>
          <Button label={T("صغير", "Small")} size="sm" variant="outline" />
          <Button label={T("التالي", "Next")} icon="arrow-forward" iconPosition="end" size="sm" />
          <Button label={T("جاري", "Busy")} loading />
          <Button label={T("مقفول", "Disabled")} disabled />
        </View>
        <View style={styles.wrapRow}>
          <IconButton icon="heart-outline" label={T("حفظ", "Save")} />
          <IconButton icon="share-outline" label={T("مشاركة", "Share")} variant="filled" />
          <View style={styles.nightChip}>
            <IconButton icon="close" label={T("إغلاق", "Close")} variant="night" />
          </View>
        </View>
      </Section>

      {/* ── Inputs ── */}
      <Section title={T("الحقول", "Inputs")}>
        <SearchField value={search} onChangeText={setSearch} placeholder={T("دور على مكان أو خدمة", "Find a place or service")} />
        <TextField label={T("الاسم الكامل", "Full name")} value={text} onChangeText={setText} required hint={T("زي ما هو في بطاقتك", "As on your ID")} />
        <TextField label={T("رقم الموبايل", "Mobile number")} value="01012345678" ltr keyboardType="phone-pad" icon="call-outline" />
        <TextField label={T("كلمة المرور", "Password")} value="secret" secureTextEntry error={T("كلمة المرور قصيرة", "Password is too short")} />
        <Select
          label={T("مقدّم الخدمة", "Provider")}
          value={select}
          onChange={setSelect}
          options={[
            { value: "any", label: T("أي حد متاح", "Anyone available"), description: T("أقرب موعد", "Earliest time") },
            { value: "sara", label: T("سارة محمد", "Sara Mohamed"), description: T("خبيرة صبغة", "Colour specialist") },
            { value: "omar", label: T("عمر", "Omar") },
          ]}
        />
      </Section>

      {/* ── Selection ── */}
      <Section title={T("الاختيار", "Selection")}>
        <Tabs
          options={[
            { value: "upcoming", label: T("الجاية", "Upcoming") },
            { value: "past", label: T("اللي فاتت", "Past") },
          ]}
          value={tab}
          onChange={setTab}
        />
        <View style={styles.wrapRow}>
          {[
            ["salons", T("صالونات", "Salons")],
            ["clinics", T("عيادات", "Clinics")],
            ["gyms", T("جيم", "Gyms")],
            ["spas", T("سبا", "Spas")],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label!}
              count={id === "salons" ? 12 : undefined}
              selected={chips.includes(id!)}
              onPress={() => setChips((c) => (c.includes(id!) ? c.filter((x) => x !== id) : [...c, id!]))}
            />
          ))}
        </View>
        <View style={styles.wrapRow}>
          <Badge label={T("مؤكد", "Confirmed")} tone="ok" icon="checkmark-circle" />
          <Badge label={T("في الانتظار", "Pending")} tone="warn" icon="time" />
          <Badge label={T("ملغي", "Cancelled")} tone="danger" icon="close-circle" />
          <Badge label={T("موثّق", "Verified")} tone="jade" />
        </View>
      </Section>

      {/* ── People and ratings ── */}
      <Section title={T("الأشخاص والتقييم", "People and ratings")}>
        <View style={styles.wrapRow}>
          <Avatar name="سارة محمد" size="sm" />
          <Avatar name="Sara Mohamed" size="md" />
          <Avatar name="QA Salon" uri={SAMPLE_PHOTO} size="lg" shape="rounded" />
          <Avatar name="Broken" uri="https://invalid.example/x.png" size="xl" />
        </View>
        <Rating value={4.2} count={37} />
        <Rating value={null} count={0} />
        <RatingInput value={stars} onChange={setStars} />
      </Section>

      {/* ── Cards ── */}
      <Section title={T("الكروت", "Cards")}>
        <View style={styles.grid}>
          <View style={grid}>
            <BusinessCard
              variant="feature"
              name={T("صالون كيو إيه للتجميل والعناية بالشعر", "QA Beauty & Hair Salon")}
              category={T("صالونات", "Salons")}
              area={T("التجمع الخامس", "New Cairo")}
              imageUri={SAMPLE_PHOTO}
              verified
              rating={4.2}
              ratingCount={37}
              fromPrice={150}
              openNow
              onPress={() => toast({ message: T("فتح صفحة المكان", "Opened the business"), tone: "info" })}
              trailing={<IconButton icon="heart-outline" label={T("حفظ", "Save")} variant="filled" />}
            />
          </View>
          <View style={grid}>
            <BusinessCard
              name={T("عيادة د. أحمد", "Dr. Ahmed Clinic")}
              category={T("عيادات", "Clinics")}
              area={T("مدينة نصر", "Nasr City")}
              rating={null}
              ratingCount={0}
              fromPrice={null}
              openNow={false}
              onPress={() => undefined}
            />
          </View>
        </View>
        <View style={styles.grid}>
          <View style={grid}>
            <ServiceCard
              name={T("صبغة شعر كاملة مع علاج الكيراتين", "Full colour with keratin treatment")}
              description={T("تشمل غسيل وتجفيف وتصفيف.", "Includes wash, dry and styling.")}
              durationMinutes={120}
              price={1850}
              nextFree={T("أقرب موعد بكرة 9:00", "Next free tomorrow 9:00")}
              onPress={() => undefined}
            />
          </View>
          <View style={grid}>
            <ServiceCard name={T("استشارة", "Consultation")} durationMinutes={15} price={null} selected onPress={() => undefined} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRow}>
          <StaffCard name={T("أي حد متاح", "Anyone")} role={T("أقرب موعد", "Earliest")} selected onPress={() => undefined} />
          <StaffCard name={T("سارة محمد", "Sara Mohamed")} role={T("خبيرة صبغة", "Colourist")} onPress={() => undefined} />
          <StaffCard name={T("عبد الرحمن إبراهيم السيد", "Abdelrahman Ibrahim")} photoUri={SAMPLE_PHOTO} onPress={() => undefined} />
        </ScrollView>
        <BookingCard
          title={T("تسريحة سهرة", "Evening styling")}
          subtitle={T("صالون كيو إيه", "QA Salon")}
          date={addDays(today, 2)}
          startTime="18:00"
          endTime="19:00"
          status={{ label: T("مؤكد", "Confirmed"), tone: "ok" }}
          price={450}
          minutesUntil={2 * 24 * 60}
          meta={[T("سارة محمد", "Sara Mohamed"), T("فرع التجمع", "New Cairo branch")]}
          onPress={() => undefined}
          actions={
            <>
              <Button label={T("تغيير الموعد", "Reschedule")} size="sm" variant="outline" icon="swap-horizontal" />
              <Button label={T("إلغاء", "Cancel")} size="sm" variant="ghost" onPress={() => setConfirm(true)} />
            </>
          }
        />
        <Card tone="tint">
          <Text variant="bodyBold">{T("كارت مميز", "Tinted card")}</Text>
          <Text variant="caption" tone="muted">
            {T("لتنبيه هادي أو اختيار.", "For a quiet highlight or a choice.")}
          </Text>
        </Card>
      </Section>

      {/* ── Headers ── */}
      <Section title={T("العناوين", "Headers")}>
        <Header title={T("حجوزاتي", "My bookings")} subtitle={T("3 مواعيد جاية", "3 upcoming")} back actions={<IconButton icon="filter-outline" label={T("فلترة", "Filter")} />} />
        <View style={styles.nightHeader}>
          <Header tone="night" title={T("أهلًا، سارة", "Hello, Sara")} subtitle={T("عندك موعدين النهاردة", "Two appointments today")} />
        </View>
      </Section>

      {/* ── Dates and times ── */}
      <Section title={T("التاريخ والوقت", "Dates and times")} note={T("الجمعة مقفول في المثال.", "Fridays are closed in this example.")}>
        <DateStrip value={day} onChange={setDay} isAvailable={closedFridays} days={21} />
        <Card>
          <Calendar value={day} onChange={setDay} isAvailable={closedFridays} />
        </Card>
        <TimeSlots
          value={slot}
          onChange={setSlot}
          slots={["09:00", "09:30", "10:00", "10:30", "11:00", "12:30", "13:00", "14:00", "16:30", "18:00", "19:30", "20:00"]}
        />
      </Section>

      {/* ── Overlays and feedback ── */}
      <Section title={T("النوافذ والتنبيهات", "Overlays and feedback")}>
        <View style={styles.wrapRow}>
          <Button label={T("نافذة سفلية", "Sheet")} variant="outline" onPress={() => setSheet(true)} />
          <Button label={T("حوار", "Dialog")} variant="outline" onPress={() => setDialog(true)} />
          <Button label={T("تأكيد", "Confirm")} variant="outline" onPress={() => setConfirm(true)} />
          <Button label={T("رسالة", "Toast")} variant="outline" onPress={() => toast({ message: T("تم حفظ التغييرات", "Changes saved"), tone: "ok" })} />
        </View>
      </Section>

      {/* ── States ── */}
      <Section title={T("الحالات", "States")}>
        <View style={styles.grid}>
          <View style={grid}>
            <Card>
              <Loading />
            </Card>
          </View>
          <View style={grid}>
            <SkeletonCard />
          </View>
        </View>
        <Card>
          <EmptyState
            icon="calendar-outline"
            title={T("مفيش حجوزات جاية", "No upcoming bookings")}
            body={T("لما تحجز موعد هيظهر هنا.", "When you book, it shows up here.")}
            action={<Button label={T("دور على مكان", "Find a place")} variant="outline" />}
          />
        </Card>
        <Card>
          <ErrorState error={new NetworkError()} onRetry={() => undefined} />
        </Card>
      </Section>

      <Text variant="caption" tone="subtle" align="center" style={styles.footnote}>
        {isTablet ? T("عرض التابلت: الكروت في أعمدة.", "Tablet layout: cards in columns.") : T("عرض الموبايل.", "Phone layout.")}
      </Text>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={T("الفلاتر", "Filters")}
        footer={<Button label={T("عرض 12 نتيجة", "Show 12 results")} fullWidth onPress={() => setSheet(false)} />}
      >
        <Text variant="label">{T("التقييم", "Rating")}</Text>
        <View style={styles.wrapRow}>
          {["4+", "3+", T("أي تقييم", "Any")].map((l) => (
            <Chip key={l} label={l} selected={l === "4+"} />
          ))}
        </View>
        <TextField label={T("أقل سعر", "Minimum price")} value="" keyboardType="numeric" ltr />
      </Sheet>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={T("فعّل الإشعارات", "Turn on notifications")}
        body={T("عشان يوصلك تنبيه قبل موعدك.", "So you're reminded before your appointment.")}
        icon="notifications-outline"
        tone="jade"
        actions={
          <>
            <Button label={T("فعّل", "Turn on")} fullWidth onPress={() => setDialog(false)} />
            <Button label={T("مش دلوقتي", "Not now")} variant="ghost" fullWidth onPress={() => setDialog(false)} />
          </>
        }
      />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        destructive
        title={T("إلغاء الحجز؟", "Cancel this booking?")}
        body={T("الموعد هيتلغي ومش هتقدر ترجعه.", "The appointment will be released and can't be restored.")}
        confirmLabel={T("إلغاء الحجز", "Cancel booking")}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 600));
          setConfirm(false);
          toast({ message: T("تم إلغاء الحجز", "Booking cancelled"), tone: "ok" });
        }}
      />
    </Screen>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {note ? (
        <Text variant="caption" tone="subtle">
          {note}
        </Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Swatch({ name, dark }: { name: keyof typeof colors; dark?: boolean }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchChip, { backgroundColor: colors[name], borderColor: dark ? colors.nightLine : colors.line }]} />
      <Text variant="tiny" tone={dark ? "inverseMuted" : "subtle"} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl, gap: spacing.xs },
  sectionBody: { gap: spacing.md, marginTop: spacing.md },
  anchor: { backgroundColor: colors.night, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatch: { width: 64, gap: spacing.xs, alignItems: "center" },
  swatchChip: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  spaceSample: { alignItems: "center", gap: spacing.xs, minWidth: 48 },
  radiusSample: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.jade,
    backgroundColor: colors.jadeTint,
    justifyContent: "center",
  },
  elevSample: {
    width: 88,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  iconCell: { width: 76, alignItems: "center", gap: spacing.xs },
  nightChip: { backgroundColor: colors.night, borderRadius: radius.full },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  staffRow: { gap: spacing.sm },
  nightHeader: { backgroundColor: colors.night, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  footnote: { marginTop: spacing.xxl },
});
