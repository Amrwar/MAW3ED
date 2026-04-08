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
    setLang(next);
    // Persist in cookie (accessible to server on next page load)
    document.cookie = `maw3ed-lang=${next};path=/;max-age=31536000;samesite=lax`;
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
