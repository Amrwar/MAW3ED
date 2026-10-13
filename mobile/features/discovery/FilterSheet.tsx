import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Sheet, Text, TextField, Touchable, Icon, colors, radius, spacing, useLocale } from "@/design";
import { useFacets } from "@/features/customer/queries";
import { availableLabel, ratingLabel, sortLabel } from "./labels";
import { AVAILABLE, DEFAULT_FILTERS, RATINGS, SORTS, type Filters, type Sort } from "./searchState";

/**
 * Every filter the search API understands, on one sheet.
 *
 * Changes are a draft until "Show results": tapping through five chips
 * should be one search, not five. Category and area options come from
 * the facets with their real counts, so nothing empty is offered; the
 * categories follow the city picked in the same sheet.
 */
export function FilterSheet({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const [draft, setDraft] = useState(value);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");

  // Each opening starts from what is applied, not from an abandoned draft
  // — adjusted while rendering, when the sheet opens or the applied
  // filters change underneath it.
  const opening = open ? value : null;
  const [seen, setSeen] = useState(opening);
  if (seen !== opening) {
    setSeen(opening);
    if (opening) {
      setDraft(opening);
      setMinText(opening.minPrice === null ? "" : String(opening.minPrice));
      setMaxText(opening.maxPrice === null ? "" : String(opening.maxPrice));
    }
  }

  const facets = useFacets(draft.city || undefined, open);
  const name = (x: { nameAr: string; nameEn: string }) => (ar ? x.nameAr : x.nameEn);
  const patch = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }));

  const categories = (facets.data?.categories ?? []).filter((c) => c.count > 0 || c.slug === draft.category);
  const parent = categories.find((c) => c.slug === draft.category);
  const children = (parent?.children ?? []).filter((c) => c.count > 0 || c.slug === draft.subcategory);
  const cities = (facets.data?.cities ?? []).filter((c) => c.count > 0 || c.slug === draft.city);
  const neighborhoods = draft.city ? (facets.data?.neighborhoods ?? []) : [];

  const parsePrice = (t: string) => {
    const n = Number(t.replace(/[^\d]/g, ""));
    return t.trim() === "" || !Number.isFinite(n) ? null : Math.min(1_000_000, Math.round(n));
  };
  const minPrice = parsePrice(minText);
  const maxPrice = parsePrice(maxText);
  const priceError =
    minPrice !== null && maxPrice !== null && minPrice > maxPrice
      ? T("أقل سعر أكبر من أعلى سعر", "Minimum is above maximum")
      : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={T("الفلاتر", "Filters")}
      footer={
        <View style={styles.footer}>
          <Button
            label={T("مسح الكل", "Clear all")}
            variant="outline"
            onPress={() => {
              setDraft({ ...DEFAULT_FILTERS, sort: draft.sort });
              setMinText("");
              setMaxText("");
            }}
            style={styles.flex}
          />
          <Button
            label={T("اعرض النتايج", "Show results")}
            disabled={Boolean(priceError)}
            onPress={() => onApply({ ...draft, minPrice, maxPrice })}
            style={styles.flex}
          />
        </View>
      }
    >
      <Section title={T("النوع", "Category")}>
        <Chips>
          <Chip label={T("الكل", "All")} selected={!draft.category} onPress={() => patch({ category: "", subcategory: "" })} />
          {categories.map((c) => (
            <Chip
              key={c.slug}
              label={name(c)}
              count={c.count}
              selected={draft.category === c.slug}
              onPress={() => patch({ category: draft.category === c.slug ? "" : c.slug, subcategory: "" })}
            />
          ))}
        </Chips>
        {children.length > 0 ? (
          <Chips>
            {children.map((c) => (
              <Chip
                key={c.slug}
                label={name(c)}
                count={c.count}
                selected={draft.subcategory === c.slug}
                onPress={() => patch({ subcategory: draft.subcategory === c.slug ? "" : c.slug })}
              />
            ))}
          </Chips>
        ) : null}
      </Section>

      <Section title={T("المكان", "Location")}>
        <Chips>
          <Chip label={T("كل المدن", "All cities")} selected={!draft.city} onPress={() => patch({ city: "", neighborhood: "" })} />
          {cities.map((c) => (
            <Chip
              key={c.slug}
              label={name(c)}
              count={c.count}
              selected={draft.city === c.slug}
              // A category is kept: the counts above refresh for the new city.
              onPress={() => patch({ city: draft.city === c.slug ? "" : c.slug, neighborhood: "" })}
            />
          ))}
        </Chips>
        {neighborhoods.length > 0 ? (
          <>
            <Text variant="caption" tone="subtle">
              {T("المنطقة", "Area")}
            </Text>
            <Chips>
              {neighborhoods.map((n) => (
                <Chip
                  key={n.slug}
                  label={name(n)}
                  selected={draft.neighborhood === n.slug}
                  onPress={() => patch({ neighborhood: draft.neighborhood === n.slug ? "" : n.slug })}
                />
              ))}
            </Chips>
          </>
        ) : null}
      </Section>

      <Section title={T("المواعيد", "Availability")}>
        <Chips>
          {AVAILABLE.map((a) => (
            <Chip key={a} label={availableLabel(a, lang)} selected={draft.available === a} onPress={() => patch({ available: a })} />
          ))}
        </Chips>
      </Section>

      <Section title={T("التقييم", "Rating")}>
        <Chips>
          {RATINGS.map((r) => (
            <Chip key={r} label={ratingLabel(r, lang)} selected={draft.rating === r} onPress={() => patch({ rating: r })} />
          ))}
        </Chips>
        {draft.rating > 0 ? (
          <Text variant="caption" tone="subtle">
            {T("الأماكن اللي لسه ماتقيّمتش مش هتظهر.", "Places with no reviews yet are left out.")}
          </Text>
        ) : null}
      </Section>

      <Section title={T("السعر (ج.م)", "Price (EGP)")}>
        <View style={styles.priceRow}>
          <View style={styles.flex}>
            <TextField
              label={T("من", "Min")}
              value={minText}
              onChangeText={setMinText}
              keyboardType="number-pad"
              placeholder="0"
              ltr
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={T("لحد", "Max")}
              value={maxText}
              onChangeText={setMaxText}
              keyboardType="number-pad"
              placeholder="—"
              ltr
              error={priceError}
            />
          </View>
        </View>
      </Section>

      <Section title={T("حاجات تانية", "More")}>
        <Chips>
          <Chip label={T("موثّق بس", "Verified only")} icon="checkmark-circle-outline" selected={draft.verified} onPress={() => patch({ verified: !draft.verified })} />
          <Chip label={T("تأكيد فوري", "Instant confirmation")} icon="flash-outline" selected={draft.instant} onPress={() => patch({ instant: !draft.instant })} />
          <Chip label={T("دفع أونلاين", "Pay online")} icon="card-outline" selected={draft.online} onPress={() => patch({ online: !draft.online })} />
        </Chips>
      </Section>
    </Sheet>
  );
}

/** Sort choices, one tap applies. */
export function SortSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: Sort;
  onChange: (s: Sort) => void;
}) {
  const { lang } = useLocale();
  return (
    <Sheet open={open} onClose={onClose} title={lang === "ar" ? "الترتيب" : "Sort by"}>
      <View accessibilityRole="radiogroup">
        {SORTS.map((s) => {
          const selected = s === value;
          return (
            <Touchable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(s)}
              style={[styles.option, selected && styles.optionOn]}
            >
              <Text variant={selected ? "bodyBold" : "body"} style={styles.flex}>
                {sortLabel(s, lang)}
              </Text>
              {selected ? <Icon name="checkmark" color={colors.jade} /> : null}
            </Touchable>
          );
        })}
      </View>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, paddingBottom: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  priceRow: { flexDirection: "row", gap: spacing.md },
  footer: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  optionOn: { backgroundColor: colors.jadeSoft },
});
