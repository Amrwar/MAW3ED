"use client";

import Logo from "@/components/shared/Logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const a = t.auth;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-ground)]">
      <header className="flex h-20 shrink-0 items-center gap-4 border-b border-[var(--color-line)] px-6">
        <Logo size="sm" />
        <Link
          href="/"
          className="ms-auto flex min-h-11 items-center gap-2 text-[0.84375rem] text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          {a.backToHome}
          <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-14">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>

      <footer className="py-6 text-center text-xs text-[var(--color-subtle)]">
        {a.copyright}
      </footer>
    </div>
  );
}
