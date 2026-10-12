"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { VERSION_LABEL, APP_COMMIT } from "@/lib/version";

export default function Footer({ cta = true }: { cta?: boolean }) {
  const { t, lang } = useLanguage();
  const f = t.footer;

  const columns = [
    {
      title: f.platform,
      links: [
        { label: f.links.home,       href: "/" },
        { label: f.links.businesses, href: "/businesses" },
        { label: f.links.categories, href: "/categories" },
        { label: f.links.cities,     href: "/cities" },
        { label: f.links.pricing,    href: "/pricing" },
      ],
    },
    {
      title: f.business,
      links: [
        { label: f.links.forBusiness, href: "/for-business" },
        { label: f.links.addBusiness, href: "/signup?type=business" },
        { label: f.links.signup,      href: "/signup" },
        { label: f.links.login,       href: "/login" },
      ],
    },
    {
      title: f.support,
      links: [
        { label: f.links.contact, href: "/contact" },
        { label: f.links.faq,     href: "/faq" },
        { label: f.links.privacy, href: "/privacy" },
        { label: f.links.terms,   href: "/terms" },
      ],
    },
  ];

  const madeIn = lang === "ar" ? "صُنع في القاهرة" : "Made in Cairo";

  return (
    /*
      The footer closes the frame the hero opens.

      It used to be --color-surface: the same white as the cards sitting
      on top of it, so the page did not end anywhere, it just stopped.
      Dark gives the page a bottom edge, and it is the same --color-night
      the hero opens on, so the two bracket everything between them.
    */
    <footer className="bg-[var(--color-night)] text-[var(--color-inverse)]">
      <div className={cn("container-app", cta ? "pt-0" : "pt-16")}>

        {/* The one thing worth asking for, where a reader who got this
            far is most likely to say yes.

            Off on a page that already ends with its own call to action.
            The home page does, and two near-identical asks stacked back
            to back read as a page that does not know what it wants. */}
        {cta && (
          /*
            Relative, not a negative top margin. A negative margin on the
            first child drags the footer's own top edge up with it, so
            the card lands exactly on the boundary and overlaps nothing.
            Relative leaves the footer's box where it is and moves only
            the paint, so the card genuinely straddles the seam; the
            negative bottom margin takes back the space it left behind.
          */
          <div className="relative -top-11 -mb-6 flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-xl)] bg-[var(--color-jade)] px-8 py-10 shadow-[var(--shadow-float)] sm:px-11">
            <div className="min-w-0">
              <h2 className="m-0 text-[1.375rem] font-bold leading-[1.45] text-[var(--color-inverse)] sm:text-[1.625rem]">
                {f.ctaTitle}
              </h2>
              <p className="m-0 mt-2 text-[0.9375rem] text-[var(--color-jade-soft)]">
                {f.ctaBody}
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-inverse)] px-8 py-4 text-[0.9375rem] font-extrabold text-[var(--color-jade-hover)] transition-colors hover:bg-[var(--color-jade-soft)]"
            >
              {f.ctaButton}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 pb-13 pt-13 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">

          <div className="sm:col-span-2 lg:col-span-1">
            <Logo size="sm" variant="white" className="mb-4" />
            <p className="max-w-[34ch] text-[0.84375rem] leading-[1.9] text-[var(--color-night-text)]">
              {f.tagline}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-4 text-[0.8125rem] font-bold text-[var(--color-inverse)]">
                {col.title}
              </h2>
              <ul className="link-list flex flex-col">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.84375rem] text-[var(--color-night-text)] transition-colors hover:text-[var(--color-inverse)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[var(--color-night-line)] py-7">
          <p className="m-0 text-[0.78125rem] text-[var(--color-night-subtle)]">
            {f.copyright}{" "}
            {/*
              Quiet on purpose: nobody reads a footer for this, but the
              first person to report a bug that is already fixed needs
              somewhere to look. title= carries the full commit.
            */}
            <span
              title={APP_COMMIT ? `build ${APP_COMMIT}` : undefined}
            >
              {VERSION_LABEL}
            </span>
          </p>
          <p className="m-0 text-[0.78125rem] text-[var(--color-night-subtle)]">{madeIn}</p>
        </div>
      </div>
    </footer>
  );
}
