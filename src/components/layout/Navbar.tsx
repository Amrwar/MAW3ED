"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "الرئيسية",    href: "/" },
  { label: "تصفح الأعمال", href: "/businesses" },
  { label: "للأعمال",     href: "/dashboard", highlight: true },
];

export default function Navbar() {
  const { data: session } = useSession();
  const [isOpen,  setIsOpen]  = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLoggedIn  = !!session?.user;
  const hasBusiness = !!session?.user?.businessId;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[var(--color-border)] shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          <Logo size="sm" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  link.highlight
                    ? "text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn btn-primary btn-sm text-sm">
                {hasBusiness ? "لوحة التحكم" : "إكمال الإعداد"}
              </Link>
            ) : (
              <>
                <Link href="/login"  className="btn btn-ghost btn-sm text-sm">تسجيل دخول</Link>
                <Link href="/signup" className="btn btn-primary btn-sm text-sm">ابدأ مجانًا</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="القائمة"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden border-t border-[var(--color-border)] bg-white py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  link.highlight
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 px-4 pt-2">
              {isLoggedIn ? (
                <Link href="/dashboard" className="btn btn-primary w-full">
                  {hasBusiness ? "لوحة التحكم" : "إكمال الإعداد"}
                </Link>
              ) : (
                <>
                  <Link href="/login"  className="btn btn-outline w-full">تسجيل دخول</Link>
                  <Link href="/signup" className="btn btn-primary w-full">ابدأ مجانًا</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
