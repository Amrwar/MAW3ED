"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import ErrorPage from "@/components/shared/ErrorPage";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: Props) {
  const { lang } = useLanguage();

  // Render errors caught here never reached Sentry: the boundary only
  // logged to the console (final audit F-35). Once per error; without a
  // DSN, Sentry is a no-op.
  useEffect(() => {
    console.error("[RouteError]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorPage
      code="500"
      title={lang === "en" ? "Something went wrong" : "حدث خطأ في النظام"}
      onReset={reset}
    />
  );
}
