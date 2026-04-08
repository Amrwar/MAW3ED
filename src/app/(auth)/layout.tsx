"use client";

import Logo from "@/components/shared/Logo";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const a = t.auth;

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] flex flex-col">
      <header className="h-14 flex items-center px-5 border-b border-[var(--color-border)] bg-white">
        <Logo size="sm" />
        <Link
          href="/"
          className="ms-auto text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {a.backToHome}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="py-4 text-center text-xs text-[var(--color-text-muted)]">
        {a.copyright}
      </footer>
    </div>
  );
}
