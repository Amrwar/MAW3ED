"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { translations, type Lang, type T } from "@/lib/i18n";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/lang";
import { hasTwin, localizePath, splitLang } from "@/lib/locale-path";

interface LanguageContextValue {
  lang: Lang;
  t: T;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLang = "ar",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);

  // Sync html attributes whenever language changes
  useEffect(() => {
    const t = translations[lang];
    document.documentElement.lang = t.lang;
    document.documentElement.dir  = t.dir;
  }, [lang]);

  const toggleLang = useCallback(() => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    // Saved first: the proxy reads it on the very next request.
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=${LANG_COOKIE_MAX_AGE};samesite=lax`;

    // A public page has an address per language: go to the other one,
    // as a full load, so everything the server drew (title, metadata,
    // server-rendered text) comes back in the new language too.
    const { path } = splitLang(window.location.pathname);
    if (hasTwin(path)) {
      const { search, hash } = window.location;
      window.location.assign(localizePath(path, next) + search + hash);
      return;
    }
    setLang(next);
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    t: translations[lang] as unknown as T,
    toggleLang,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

/**
 * Just the language, and Arabic outside a provider rather than an error:
 * for shared pieces such as links that may render in either place.
 */
export function useLang(): Lang {
  return useContext(LanguageContext)?.lang ?? "ar";
}
