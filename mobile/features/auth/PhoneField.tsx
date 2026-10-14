import { useId, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
  Icon,
  SearchField,
  Sheet,
  Text,
  Touchable,
  colors,
  fonts,
  ltr,
  radius,
  spacing,
  touchTarget,
  useLocale,
} from "@/design";
import { COUNTRIES, EGYPT, flagOf, isolateLtr, matchesCountry, type Country } from "./countries";

/**
 * A phone number with its country.
 *
 * The country is a button beside the number — flag and calling code —
 * opening a searchable list in either language. People type their
 * number the way they know it; readPhone() turns that into the
 * international form. The row always reads left to right, "+20" then the
 * number, as a phone number does in Arabic too.
 */
export function PhoneField({
  label,
  value,
  onChangeText,
  country,
  onCountryChange,
  error,
  hint,
  editable = true,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  country: Country;
  onCountryChange: (c: Country) => void;
  error?: string | null;
  hint?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const name = (c: Country) => (ar ? c.ar : c.en);

  const border = error ? colors.danger : focused ? colors.jade : colors.line2;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="ink2" nativeID={labelId}>
        {label}
      </Text>

      <View style={[styles.row, ltr, { borderColor: border }, focused && styles.focused]}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${ar ? "الدولة" : "Country"}: ${name(country)} +${country.dial}`}
          accessibilityHint={ar ? "غيّر الدولة" : "Change country"}
          onPress={() => setPicking(true)}
          disabled={!editable}
          style={styles.country}
        >
          <Text variant="body">{flagOf(country.iso)}</Text>
          <Text variant="bodyBold">{isolateLtr(`+${country.dial}`)}</Text>
          <Icon name="chevron-down" size="sm" color={colors.subtle} />
        </Touchable>
        <View style={styles.divider} />
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          accessibilityHint={error ?? hint}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={country.iso === "EG" ? "10 1234 5678" : ar ? "رقم الموبايل" : "Phone number"}
          placeholderTextColor={colors.faint}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="next"
          style={styles.input}
        />
      </View>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}

      <CountrySheet
        open={picking}
        onClose={() => setPicking(false)}
        selected={country}
        onSelect={(c) => {
          onCountryChange(c);
          setPicking(false);
        }}
      />
    </View>
  );
}

function CountrySheet({
  open,
  onClose,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: Country;
  onSelect: (c: Country) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");

  // The selected country and Egypt first — most people pick one of
  // those — then everyone, alphabetical in the language being read.
  const list = useMemo(() => {
    const collator = new Intl.Collator(lang);
    const sorted = [...COUNTRIES].sort((a, b) => collator.compare(ar ? a.ar : a.en, ar ? b.ar : b.en));
    const top = selected.iso === EGYPT.iso ? [EGYPT] : [selected, EGYPT];
    const rest = sorted.filter((c) => !top.includes(c));
    return [...top, ...rest].filter((c) => matchesCountry(c, query));
  }, [lang, ar, selected, query]);

  return (
    <Sheet
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={ar ? "اختر الدولة" : "Choose your country"}
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={ar ? "ابحث باسم الدولة أو الكود" : "Search by country or code"}
      />
      <View accessibilityRole="radiogroup">
        {list.map((c) => {
          const isSelected = c.iso === selected.iso;
          return (
            <Touchable
              key={c.iso}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${ar ? c.ar : c.en} +${c.dial}`}
              onPress={() => {
                setQuery("");
                onSelect(c);
              }}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <Text variant="heading">{flagOf(c.iso)}</Text>
              <Text variant="body" style={styles.optionName} numberOfLines={1}>
                {ar ? c.ar : c.en}
              </Text>
              <Text variant="label" tone="subtle" style={ltr}>
                {isolateLtr(`+${c.dial}`)}
              </Text>
              {isSelected ? <Icon name="checkmark" color={colors.jade} /> : null}
            </Touchable>
          );
        })}
        {list.length === 0 ? (
          <Text variant="body" tone="subtle" align="center">
            {ar ? "مفيش دولة بالاسم ده" : "No country matches"}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  // A phone number reads left to right in every language.
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  focused: { borderWidth: 2 },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget - 4,
  },
  divider: { width: 1, alignSelf: "stretch", marginVertical: spacing.sm, backgroundColor: colors.line2 },
  input: {
    flex: 1,
    // A browser gives <input> an intrinsic width; without this the web
    // build pushes the field past the card on a 320 pt screen.
    minWidth: 0,
    minHeight: touchTarget - 4,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  optionSelected: { backgroundColor: colors.jadeSoft },
  optionName: { flex: 1 },
});
