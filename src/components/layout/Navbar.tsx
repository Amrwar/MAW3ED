"use client";

import { useState, useEffect } from "react";
import Link from "@/components/shared/LocaleLink";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X, Globe } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { UserMenu, NotificationBell } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { splitLang } from "@/lib/locale-path";

/**
 * The site header.
 *
 * From 768px up it is one row: the logo and the site's pages on the
 * start side, language, notifications and the account on the end side.
 * Below that the pages fold into a menu button, and the account stays
 * its own avatar button beside it at every width (UserMenu: a popover,
 * a bottom sheet on a phone), so the two never share one long list.
 */
export default function Navbar() {
  const { data: session, status } = useSession();
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

  const user       = session?.user;
  const isLoggedIn = !!user;
  // Until the session is known, show neither set: a signed-in customer
  // briefly offered "Sign in" and "List your business" reads as being
  // signed out.
  const sessionPending = status === "loading";

  function isActive(href: string) {
    // The page, not its address: /en/pricing is the pricing page.
    const page = splitLang(pathname).path;
    if (href === "/") return page === "/";
    return page.startsWith(href);
  }

  const navLinks = [
    { label: t.nav.home,        href: "/"             },
    { label: t.nav.businesses,  href: "/businesses"   },
    { label: t.nav.categories,  href: "/categories"   },
    { label: t.nav.pricing,     href: "/pricing"      },
    { label: t.nav.forBusiness, href: "/for-business" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-colors duration-300",
        // Dark, over a light hero (.hero-wash): two surfaces with an
        // edge between them, rather than one block in the bar's colour.
        "bg-[var(--color-night)]/92 backdrop-blur-md",
        scrolled && "border-b border-[var(--color-night-line)]",
      )}
    >
      {/* Full width, not the 1240px page column: on a wide screen a
          capped bar floats in the middle, and the logo and pages should
          sit at the start edge with the account at the end edge. */}
      <div className="w-full px-5 md:px-8 xl:px-10">
        <div className="flex items-center h-20 gap-6 lg:gap-8">

          <Logo size="sm" href="/" variant="white" />

          {/* Pages: the start side, from 768px */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-7 flex-1 min-w-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  // "Home" only where there is room: the logo is a home
                  // link too, and a tablet needs the space.
                  link.href === "/" ? "hidden lg:flex" : "flex",
                  "min-h-11 items-center whitespace-nowrap text-[0.875rem] lg:text-[0.90625rem] transition-colors",
                  isActive(link.href)
                    ? "font-bold text-[var(--color-night-accent)]"
                    : "text-[var(--color-night-text)] hover:text-[var(--color-inverse)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Language, notifications, account: the end side */}
          <div className="ms-auto flex items-center gap-2 lg:gap-3.5 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1.5 lg:gap-2 h-11 px-3 lg:px-3.5 text-xs lg:text-[0.8125rem] rounded-full border border-[var(--color-night-line)] bg-[var(--color-night-2)] text-[var(--color-night-text)] hover:text-[var(--color-inverse)] transition-colors"
            >
              <Globe size={14} strokeWidth={1.6} aria-hidden="true" />
              {t.nav.langToggle}
            </button>

            {sessionPending ? null : isLoggedIn && user ? (
              <>
                <span className="hidden md:block">
                  <NotificationBell />
                </span>
                <UserMenu user={user} />
              </>
            ) : (
              <>
                <Link
                  href="/account-login"
                  className="hidden md:flex min-h-11 items-center px-1 text-[0.90625rem] font-bold text-[var(--color-inverse)] transition-colors hover:text-[var(--color-night-accent)]"
                >
                  {t.nav.login}
                </Link>
                {/* Beside five page links there is room for it only on a
                    wide screen; "For Business" is one of those links. */}
                {/* Wrapped: .btn sets its own display, which would beat
                    a `hidden` on the link itself. */}
                <span className="hidden lg:inline-flex">
                  <Link href="/signup?type=business" className="btn btn-primary btn-sm btn-pill">
                    {t.nav.addBusiness}
                  </Link>
                </span>
              </>
            )}

            <button
              type="button"
              className="md:hidden flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-inverse)] hover:bg-[var(--color-night-2)] transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={lang === "ar" ? "القائمة" : "Menu"}
              aria-expanded={isOpen}
              aria-controls="site-menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Pages, below 768px. The account is the avatar's own menu. */}
        {isOpen && (
          <nav
            id="site-menu"
            className="md:hidden mb-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-dropdown)] animate-dropdown-in"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "flex items-center min-h-12 px-4 text-[0.9375rem] rounded-[var(--radius-md)] transition-colors",
                  isActive(link.href)
                    ? "font-bold text-[var(--color-jade)] bg-[var(--color-jade-soft)]"
                    : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                {link.label}
              </Link>
            ))}

            {!isLoggedIn && !sessionPending && (
              <div className="mt-2 pt-3 border-t border-[var(--color-line)] px-2 pb-1 flex flex-col gap-2.5">
                <Link href="/account-login" className="btn btn-outline w-full">
                  {t.nav.login}
                </Link>
                <Link href="/signup?type=business" className="btn btn-primary w-full">
                  {t.nav.addBusiness}
                </Link>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
