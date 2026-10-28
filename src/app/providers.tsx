"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/components/ui/Toast";
import ServiceWorker from "@/components/shared/ServiceWorker";
import type { Lang } from "@/lib/i18n";

export default function Providers({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: Lang;
}) {
  return (
    <SessionProvider>
      <LanguageProvider initialLang={lang}>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </LanguageProvider>
    </SessionProvider>
  );
}
