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

  useEffect(() => { setIsOpen(false); }, [pathname]);

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

  const navBase = scrolled
    ? "bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm"
    : "bg-white/90 backdrop-blur-sm";

  // ── Translated mobile menu labels ─────────────────────────
  const ML = {
    profile:   lang === "ar" ? "الملف الشخصي" : "Profile",
    dashboard: lang === "ar" ? "لوحة التحكم"  : "Dashboard",
    business:  lang === "ar" ? "إدارة نشاطي"   : "My Business",
    settings:  lang === "ar" ? "الإعدادات"     : "Settings",
    logout:    lang === "ar" ? "تسجيل الخروج"  : "Log out",
  };

  return (
    <header className={cn("fixed top-0 inset-x-0 z-50 transition-all duration-300", navBase)}>
      <div className="container-app">
        <div className="flex items-center justify-between h-16 gap-6">

          {/* Logo */}
          <Logo size="sm" href="/" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive(link.href)
                    ? "text-[#3B82F6] bg-[#DBEAFE]"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ── Desktop actions ── */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-all"
            >
              <Globe size={13} />
              {t.nav.langToggle}
            </button>

            {isLoggedIn && user ? (
              /* Logged-in: bell + user menu */
              <>
                <NotificationBell />
                <UserMenu user={user} />
              </>
            ) : (
              /* Logged-out: login + signup */
              <>
                <Link href="/login" className="btn btn-ghost btn-sm text-[#475569]">
                  {t.nav.login}
                </Link>
                <Link href="/signup?type=business" className="btn btn-accent btn-sm">
                  {t.nav.addBusiness}
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile: lang toggle + hamburger ── */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            >
              <Globe size={12} />
              {t.nav.langToggle}
            </button>
            <button
              className="p-2 rounded-lg text-[#475569] hover:bg-[#F8FAFC] transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        {isOpen && (
          <div className="lg:hidden border-t border-[#E2E8F0] bg-white py-3 animate-dropdown-in">

            {/* Nav links */}
            <div className="space-y-0.5 px-2">
              <Link
                href="/"
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                  isActive("/")
                    ? "text-[#3B82F6] bg-[#DBEAFE]"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]",
                )}
              >
                {t.nav.home}
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                    isActive(link.href)
                      ? "text-[#3B82F6] bg-[#DBEAFE]"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Auth section */}
            {isLoggedIn && user ? (
              /* ── Logged-in mobile section ── */
              <div className="mt-2 pt-3 border-t border-[#E2E8F0] px-2">

                {/* User identity card */}
                <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <UserAvatar name={user.name} email={user.email} size="lg" />
                  <div className="min-w-0 flex-1">
                    {user.name && (
                      <p className="text-sm font-bold text-[#0F172A] truncate">{user.name}</p>
                    )}
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">{user.email}</p>
                  </div>
                </div>

                {/* Menu items */}
                <div className="space-y-0.5">
                  <MobileMenuItem
                    icon={User2}
                    label={ML.profile}
                    href="/profile"
                  />
                  {hasBusiness ? (
                    <MobileMenuItem
                      icon={LayoutDashboard}
                      label={ML.dashboard}
                      href="/dashboard"
                    />
                  ) : (
                    <MobileMenuItem
                      icon={Store}
                      label={ML.business}
                      href="/onboarding"
                    />
                  )}
                  <MobileMenuItem
                    icon={Settings2}
                    label={ML.settings}
                    href="/dashboard/settings"
                  />
                </div>

                {/* Logout — visually separated at the bottom */}
                <div className="mt-2 pt-2 border-t border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={handleMobileLogout}
                    className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
                  >
                    <LogOut
                      size={16}
                      strokeWidth={1.8}
                      className="shrink-0 text-red-400 group-hover:text-red-500 transition-colors"
                    />
                    {ML.logout}
                  </button>
                </div>
              </div>

            ) : (
              /* ── Logged-out mobile section ── */
              <div className="mt-3 pt-3 border-t border-[#E2E8F0] px-4 flex flex-col gap-2">
                <Link href="/login" className="btn btn-outline w-full">
                  {t.nav.login}
                </Link>
                <Link href="/signup?type=business" className="btn btn-accent w-full">
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

// ─── MobileMenuItem helper ─────────────────────────────────

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
      className="group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-all duration-150"
    >
      <Icon
        size={16}
        strokeWidth={1.8}
        className="shrink-0 text-[#94A3B8] group-hover:text-[#64748B] transition-colors"
      />
      {label}
    </Link>
  );
}
