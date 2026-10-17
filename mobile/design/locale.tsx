import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Lang } from "@/lib/format";
import { strings, type StringKey } from "./strings";

/**
 * Language and direction, for the whole app — the one place RTL is
 * decided.
 *
 * Direction is structural: the provider sets `direction` on the root
 * view, and Yoga resolves every `start`/`end` beneath it — margins,
 * padding, borders, positions, the order of a row. Components never
 * say left or right (design/rtl.test.ts holds them to it), so a screen
 * is written once and is correct in both languages without a single
 * `isRTL ? … : …` in it.
 *
 * Three things layout direction cannot decide on its own, and so this
 * provides: text alignment (Text reads `align`), icons that point
 * somewhere (Icon reads `isRTL`), and words (`t`).
 *
 * The native build still forces RTL (app.config.ts), so the first frame
 * after install is Arabic-correct. Choosing English sets `ltr` here and
 * the layout follows at once — no restart. What does not follow is the
 * system navigation chrome's swipe-back edge, which the OS fixes at
 * launch; that is accepted for a language most users never pick.
 */

export type Dir = "rtl" | "ltr";

interface LocaleState {
  lang: Lang;
  dir: Dir;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  /** A string the design system itself shows: "Close", "Try again". */
  t: (key: StringKey) => string;
}

const STORAGE_KEY = "maw3ed.lang";

const LocaleContext = createContext<LocaleState | null>(null);

/**
 * The language the provider last showed — what useLocale answers outside
 * it, e.g. in the root ErrorBoundary that replaces the provider's tree.
 */
let lastLang: Lang = "ar";

export function LocaleProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? "ar");

  // A stored choice, if there is one. Arabic until it is read — the
  // product's language, and what the native build already lays out.
  useEffect(() => {
    if (initialLang) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "ar") setLangState(saved);
      })
      .catch(() => undefined);
  }, [initialLang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  useEffect(() => {
    lastLang = lang;
  }, [lang]);

  const value = useMemo<LocaleState>(() => {
    const dir: Dir = lang === "ar" ? "rtl" : "ltr";
    return { lang, dir, isRTL: dir === "rtl", setLang, t: (key) => strings[lang][key] };
  }, [lang, setLang]);

  return (
    <LocaleContext.Provider value={value}>
      <View style={[styles.root, { direction: value.dir }]}>{children}</View>
    </LocaleContext.Provider>
  );
}

/**
 * The locale. Outside a provider — a component rendered in isolation, or
 * the root ErrorBoundary after a crash — it answers with the language the
 * provider last showed (Arabic before there was one) rather than throwing.
 */
export function useLocale(): LocaleState {
  return useContext(LocaleContext) ?? FALLBACK[lastLang];
}

const FALLBACK: Record<Lang, LocaleState> = {
  ar: { lang: "ar", dir: "rtl", isRTL: true, setLang: () => undefined, t: (key) => strings.ar[key] },
  en: { lang: "en", dir: "ltr", isRTL: false, setLang: () => undefined, t: (key) => strings.en[key] },
};

/**
 * Lay a subtree out in a direction other than the app's — the design
 * system showcase uses it to show both side by side. Screens should
 * never need it.
 */
export function DirectionScope({ dir, children }: { dir: Dir; children: ReactNode }) {
  const parent = useLocale();
  const value = useMemo<LocaleState>(() => {
    const lang: Lang = dir === "rtl" ? "ar" : "en";
    return { ...parent, lang, dir, isRTL: dir === "rtl", t: (key) => strings[lang][key] };
  }, [dir, parent]);
  return (
    <LocaleContext.Provider value={value}>
      <View style={{ direction: dir }}>{children}</View>
    </LocaleContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
