import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Badge, Button, Icon, ServiceCard, Sheet, Text, Touchable, colors, radius, spacing, useLocale } from "@/design";
import { nextFreeLabel } from "@/features/discovery/BusinessCard";
import { duration, money, num } from "@/lib/format";
import type { PublicProfile, PublicStaffMember } from "@/types/api";
import { KIND_WORDS, servicesOf, staffFor, type ProfileKind } from "./profile";
import { HoursTable } from "./sections";

type Service = PublicProfile["services"][number];

export interface BookingChoice {
  serviceId: string;
  /** Null means whoever is free. */
  staffId: string | null;
}

/**
 * One service, opened from the list: what it is, what it costs, and —
 * where the business has people to choose from — who does it.
 *
 * Choosing a person is optional and carried into booking; "Anyone
 * available" is the default because it finds the earliest time.
 */
export function ServiceSheet({
  service,
  p,
  kind,
  initialStaffId,
  onClose,
  onBook,
}: {
  service: Service | null;
  p: PublicProfile;
  kind: ProfileKind;
  initialStaffId?: string | null;
  onClose: () => void;
  onBook: (choice: BookingChoice) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [staffId, setStaffId] = useState<string | null>(initialStaffId ?? null);

  useEffect(() => {
    setStaffId(initialStaffId ?? null);
  }, [service?.id, initialStaffId]);

  if (!service) return null;
  const name = (!ar && service.nameEn) || service.nameAr;
  const people = kind === "dining" ? [] : staffFor(p.staff, service.id);
  const price = money(service.price, service.currency, lang);
  const words = KIND_WORDS[kind];

  return (
    <Sheet
      open
      onClose={onClose}
      title={name}
      footer={
        <View style={styles.footer}>
          <Button
            label={words.book[lang]}
            icon="open-outline"
            iconPosition="end"
            onPress={() => onBook({ serviceId: service.id, staffId })}
            accessibilityHint={ar ? "بيكمّل الحجز على موقع مواعيد" : "Continues booking on the Maw3ed website"}
          />
          <Text variant="caption" tone="subtle" align="center">
            {ar ? "هتختار اليوم والوقت في الخطوة الجاية، على موقع مواعيد." : "You'll pick a day and time next, on the Maw3ed website."}
          </Text>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.facts}>
          <Badge tone="neutral" icon="time-outline" label={duration(service.durationMinutes, lang)} />
          {price ? <Badge tone="jade" icon="pricetag-outline" label={price} /> : null}
          {p.policies.depositPercent && service.price ? (
            <Badge
              tone="info"
              icon="card-outline"
              label={ar ? `عربون ${num(p.policies.depositPercent, lang)}٪ أونلاين` : `${p.policies.depositPercent}% deposit online`}
            />
          ) : null}
        </View>

        {ar && service.descriptionAr ? (
          <Text variant="body" tone="ink2">
            {service.descriptionAr}
          </Text>
        ) : null}

        {people.length > 0 ? (
          <View style={styles.people}>
            <Text variant="label" tone="muted" accessibilityRole="header">
              {ar ? `مين يعملها؟ (اختياري)` : "Who would you like? (optional)"}
            </Text>
            <PersonOption
              selected={staffId === null}
              title={ar ? "أي حد متاح" : "Anyone available"}
              subtitle={ar ? "أسرع طريقة تلاقي ميعاد" : "The quickest way to an opening"}
              onPress={() => setStaffId(null)}
            />
            {people.map((m) => {
              const mName = (!ar && m.nameEn) || m.nameAr;
              return (
                <PersonOption
                  key={m.id}
                  selected={staffId === m.id}
                  title={mName}
                  subtitle={[m.role, nextFreeLabel(m.nextSlot, lang)].filter(Boolean).join(" · ") || null}
                  photo={m.photo}
                  onPress={() => setStaffId(m.id)}
                />
              );
            })}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

function PersonOption({
  selected,
  title,
  subtitle,
  photo,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle: string | null;
  photo?: string | null;
  onPress: () => void;
}) {
  return (
    // A radio, not a plain card: one of these is chosen, and a screen
    // reader has to say which.
    <Touchable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
      style={[styles.optionCard, selected && styles.optionSelected]}
    >
      <View style={styles.option}>
        {photo !== undefined ? (
          <Avatar name={title} uri={photo} size="sm" />
        ) : (
          <View style={styles.anyone}>
            <Icon name="people-outline" color={colors.jade} />
          </View>
        )}
        <View style={styles.flex}>
          <Text variant="bodyBold">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="subtle">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Icon name={selected ? "radio-button-on" : "radio-button-off"} color={selected ? colors.jade : colors.faint} />
      </View>
    </Touchable>
  );
}

/**
 * One person: who they are, what they treat or do, when they work, and
 * their services — each of which books with them.
 */
export function StaffSheet({
  member,
  p,
  kind,
  onClose,
  onPickService,
}: {
  member: PublicStaffMember | null;
  p: PublicProfile;
  kind: ProfileKind;
  onClose: () => void;
  onPickService: (service: Service, member: PublicStaffMember) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  if (!member) return null;
  const name = (!ar && member.nameEn) || member.nameAr;
  const next = nextFreeLabel(member.nextSlot, lang);
  const services = servicesOf(member, p.services);
  const works = member.hours.some((h) => !h.isClosed);

  return (
    <Sheet open onClose={onClose} title={name}>
      <View style={styles.body}>
        <View style={styles.who}>
          <Avatar name={name} uri={member.photo} size="xl" />
          <View style={styles.flex}>
            {member.role ? (
              <Text variant="body" tone="muted">
                {member.role}
              </Text>
            ) : null}
            {next ? <Badge tone="jade" icon="flash-outline" label={next} /> : null}
          </View>
        </View>

        {member.specialties.length > 0 ? (
          <View style={styles.people}>
            <Text variant="label" tone="muted" accessibilityRole="header">
              {kind === "clinic" ? (ar ? "التخصصات" : "Specialties") : ar ? "شاطر في" : "Specialises in"}
            </Text>
            <View style={styles.facts}>
              {member.specialties.map((s) => (
                <Badge key={s} label={s} tone="neutral" />
              ))}
            </View>
          </View>
        ) : null}

        {works ? (
          <View style={styles.people}>
            <Text variant="label" tone="muted" accessibilityRole="header">
              {ar ? "مواعيد الشغل" : "Working hours"}
            </Text>
            <HoursTable hours={member.hours} />
          </View>
        ) : null}

        {services.length > 0 ? (
          <View style={styles.people}>
            <Text variant="label" tone="muted" accessibilityRole="header">
              {ar ? `احجز مع ${name}` : `Book with ${name}`}
            </Text>
            {services.map((s) => (
              <ServiceCard
                key={s.id}
                name={(!ar && s.nameEn) || s.nameAr}
                durationMinutes={s.durationMinutes}
                price={s.price}
                currency={s.currency}
                onPress={() => onPickService(s, member)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.lg },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  people: { gap: spacing.sm },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  optionCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.jade, backgroundColor: colors.jadeTint },
  anyone: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.jadeSoft, alignItems: "center", justifyContent: "center" },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  footer: { gap: spacing.sm },
});
