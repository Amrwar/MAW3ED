"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Menu, X, Globe, LayoutDashboard, User2, Settings2, LogOut, Store } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { UserMenu, UserAvatar, NotificationBell } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Navbar() {
  const { data: session }       = useSession();
  const { t, lang, toggleLang } = useLanguage();
  const pathname                = usePathname();
  const [isOpen,   setIsOpen]   = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation. Derived from the pathname
  // rather than set from an effect, which cost an extra render pass.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setIsOpen(false);
  }

  const user        = session?.user;
  const isLoggedIn  = !!user;
  const hasBusiness = !!user?.businessId;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function handleMobileLogout() {
    setIsOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  const navLinks = [
    { label: t.nav.businesses,  href: "/businesses"  },
    { label: t.nav.categories,  href: "/categories"  },
    { label: t.nav.pricing,     href: "/pricing"     },
    { label: t.nav.forBusiness, href: "/for-business" },
  ];

  const ML = {
    profile:   lang === "ar" ? "الملف الشخصي" : "Profile",
    dashboard: lang === "ar" ? "لوحة التحكم"  : "Dashboard",
    business:  lang === "ar" ? "إدارة نشاطي"   : "My Business",
    settings:  lang === "ar" ? "الإعدادات"     : "Settings",
    logout:    lang === "ar" ? "تسجيل الخروج"  : "Log out",
  };

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-colors duration-300",
        "bg-[var(--color-ground)]/92 backdrop-blur-md",
        scrolled && "border-b border-[var(--color-line)]",
      )}
    >
      <div className="container-app">
        <div className="flex items-center justify-between h-20 gap-8">

          <Logo size="sm" href="/" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[0.90625rem] transition-colors",
                  isActive(link.href)
                    ? "font-bold text-[var(--color-jade)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-3.5 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-2 h-10 px-3.5 text-[0.8125rem] rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
            >
              <Globe size={15} strokeWidth={1.6} aria-hidden="true" />
              {t.nav.langToggle}
            </button>

            {isLoggedIn && user ? (
              <>
                <NotificationBell />
                <UserMenu user={user} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[0.90625rem] font-bold text-[var(--color-ink)] hover:text-[var(--color-jade)] transition-colors"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup?type=business"
                  className="btn btn-primary btn-sm btn-pill"
                >
                  {t.nav.addBusiness}
                </Link>
              </>
            )}
          </div>

          {/* Mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1.5 h-10 px-3 text-xs rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] transition-colors"
            >
              <Globe size={13} strokeWidth={1.6} aria-hidden="true" />
              {t.nav.langToggle}
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink)] hover:bg-[var(--color-surface-3)] transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={lang === "ar" ? "القائمة" : "Menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="lg:hidden border-t border-[var(--color-line)] bg-[var(--color-surface)] py-3 animate-dropdown-in">

            <div className="space-y-1 px-2">
              <Link
                href="/"
                className={cn(
                  "flex items-center min-h-12 px-4 text-[0.9375rem] rounded-[var(--radius-md)] transition-colors",
                  isActive("/")
                    ? "font-bold text-[var(--color-jade)] bg-[var(--color-jade-soft)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                {t.nav.home}
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center min-h-12 px-4 text-[0.9375rem] rounded-[var(--radius-md)] transition-colors",
                    isActive(link.href)
                      ? "font-bold text-[var(--color-jade)] bg-[var(--color-jade-soft)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {isLoggedIn && user ? (
              <div className="mt-3 pt-3 border-t border-[var(--color-line)] px-2">
                <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  <UserAvatar name={user.name} email={user.email} size="lg" />
                  <div className="min-w-0 flex-1">
                    {user.name && (
                      <p className="text-sm font-bold text-[var(--color-ink)] truncate">{user.name}</p>
                    )}
                    <p className="text-xs text-[var(--color-subtle)] truncate mt-0.5">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <MobileMenuItem icon={User2} label={ML.profile} href="/profile" />
                  {hasBusiness ? (
                    <MobileMenuItem icon={LayoutDashboard} label={ML.dashboard} href="/dashboard" />
                  ) : (
                    <MobileMenuItem icon={Store} label={ML.business} href="/onboarding" />
                  )}
                  <MobileMenuItem icon={Settings2} label={ML.settings} href="/dashboard/settings" />
                </div>

                <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                  <button
                    type="button"
                    onClick={handleMobileLogout}
                    className="group flex items-center gap-3 w-full min-h-12 px-4 rounded-[var(--radius-md)] text-[0.9375rem] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                  >
                    <LogOut size={17} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
                    {ML.logout}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-[var(--color-line)] px-4 flex flex-col gap-2.5">
                <Link href="/login" className="btn btn-outline w-full">
                  {t.nav.login}
                </Link>
                <Link href="/signup?type=business" className="btn btn-primary w-full">
                  {t.nav.addBusiness}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function MobileMenuItem({
  icon: Icon,
  label,
  href,
}: {
  icon:  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  href:  string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 min-h-12 px-4 rounded-[var(--radius-md)] text-[0.9375rem] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      <Icon
        size={17}
        strokeWidth={1.8}
        aria-hidden="true"
        className="shrink-0 text-[var(--color-subtle)] group-hover:text-[var(--color-muted)] transition-colors"
      />
      {label}
    </Link>
  );
}
