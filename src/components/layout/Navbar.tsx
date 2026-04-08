"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Globe } from "lucide-react";
import { useSession } from "next-auth/react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Navbar() {
  const { data: session } = useSession();
  const { t, lang, toggleLang } = useLanguage();
  const pathname = usePathname();
  const [isOpen,   setIsOpen]   = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setIsOpen(false); }, [pathname]);

  const isLoggedIn  = !!session?.user;
  const hasBusiness = !!session?.user?.businessId;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const navLinks = [
    { label: t.nav.home,        href: "/" },
    { label: t.nav.businesses,  href: "/businesses" },
    { label: t.nav.categories,  href: "/categories" },
    { label: t.nav.cities,      href: "/cities" },
    { label: t.nav.pricing,     href: "/pricing" },
    { label: t.nav.forBusiness, href: "/for-business" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/97 backdrop-blur-md border-b border-[var(--color-border)] shadow-sm"
          : "bg-white/90 backdrop-blur-sm"
      )}
    >
      <div className="container-app">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Logo size="sm" href="/" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative",
                  isActive(link.href)
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-light)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0 inset-x-3 h-0.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
              aria-label="Toggle language"
            >
              <Globe size={13} />
              {t.nav.langToggle}
            </button>

            {isLoggedIn ? (
              <Link href="/dashboard" className="btn btn-primary btn-sm">
                {hasBusiness ? t.nav.dashboard : t.nav.completeSetup}
              </Link>
            ) : (
              <>
                <Link href="/login"  className="btn btn-ghost btn-sm">{t.nav.login}</Link>
                <Link href="/signup" className="btn btn-outline btn-sm">{t.nav.signup}</Link>
                <Link href="/signup?type=business" className="btn btn-accent btn-sm">
                  {t.nav.addBusiness}
                </Link>
              </>
            )}
          </div>

          {/* Mobile: lang toggle + hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Globe size={12} />
              {t.nav.langToggle}
            </button>
            <button
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="lg:hidden border-t border-[var(--color-border)] bg-white py-4 space-y-0.5 animate-dropdown-in">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors mx-2",
                  isActive(link.href)
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-light)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="px-4 pt-3 pb-1 flex flex-col gap-2 border-t border-[var(--color-border)] mt-2 mx-2">
              {isLoggedIn ? (
                <Link href="/dashboard" className="btn btn-primary w-full">
                  {hasBusiness ? t.nav.dashboard : t.nav.completeSetup}
                </Link>
              ) : (
                <>
                  <Link href="/login"  className="btn btn-outline w-full">{t.nav.login}</Link>
                  <Link href="/signup" className="btn btn-ghost w-full">{t.nav.signup}</Link>
                  <Link href="/signup?type=business" className="btn btn-accent w-full">
                    {t.nav.addBusiness}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
