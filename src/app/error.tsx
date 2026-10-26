"use client";

import ErrorPage from "@/components/shared/ErrorPage";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  const { lang } = useLanguage();
  // Log to console so it's visible in dev; replace with Sentry/etc. in production
  console.error("[GlobalError]", error);

  return (
    <ErrorPage
      code="500"
      title={lang === "en" ? "Something went wrong" : "حدث خطأ في النظام"}
      onReset={reset}
    />
  );
}
