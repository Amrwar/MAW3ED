import Logo from "@/components/shared/Logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] flex flex-col">
      {/* Top bar */}
      <header className="h-14 flex items-center px-5 border-b border-[var(--color-border)] bg-white">
        <Logo size="sm" />
        <Link
          href="/"
          className="ms-auto text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          ← العودة للرئيسية
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="py-4 text-center text-xs text-[var(--color-text-muted)]">
        © {new Date().getFullYear()} موعد — MAW3ED. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
