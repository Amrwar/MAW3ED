"use client";

import Link from "@/components/shared/LocaleLink";
import { useSession } from "next-auth/react";
import Logo from "@/components/shared/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { VERSION_LABEL, APP_COMMIT } from "@/lib/version";
import { SUPPORT_WHATSAPP, whatsappHref } from "@/lib/contact";
import { operatorLine } from "@/lib/support";

export default function Footer() {
  const { t, lang } = useLanguage();
  const f = t.footer;
  const { data: session, status } = useSession();
  const user = session?.user;
  const signedIn = status === "authenticated" && !!user;

  // Signed in, the "join us" links are noise — and for a customer they
  // lead into business onboarding. They get their account instead, and
  // an owner their dashboard. While the session is loading neither set
  // is shown, so nobody signed in sees "Sign in" flash past.
  const accountLinks = signedIn
    ? [
        ...(user.businessId ? [{ label: t.nav.dashboard, href: "/dashboard" }] : []),
        { label: t.nav.myAccount, href: "/account" },
      ]
    : status === "loading"
      ? []
      : [
          // Both lead to the business side. A bare "Sign up" here was
          // the business form too, and customers took it for theirs.
          { label: f.links.addBusiness, href: "/signup?type=business" },
          { label: f.links.login,       href: "/login" },
        ];

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
        ...accountLinks,
      ],
    },
    {
      title: f.support,
      links: [
        { label: f.links.contact, href: "/contact" },
        { label: f.links.faq,     href: "/faq" },
        { label: f.links.help,    href: "/help" },
        { label: f.links.privacy, href: "/privacy" },
        { label: f.links.accountDeletion, href: "/account-deletion" },
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
      <div className="container-app pt-16">

        <div className="grid grid-cols-1 gap-10 pb-13 pt-13 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">

          <div className="sm:col-span-2 lg:col-span-1">
            <Logo size="sm" variant="white" className="mb-4" />
            <p className="max-w-[34ch] text-[0.84375rem] leading-[1.9] text-[var(--color-night-text)]">
              {f.tagline}
            </p>

            {/* Only once a support number is configured (lib/contact). */}
            {SUPPORT_WHATSAPP && (
              <a
                href={whatsappHref(SUPPORT_WHATSAPP)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-[0.84375rem] font-bold text-[var(--color-inverse)] hover:text-[var(--color-night-accent)]"
              >
                {lang === "ar" ? "كلّمنا على واتساب" : "Message us on WhatsApp"}
                <span dir="ltr" className="font-normal text-[var(--color-night-text)]">{SUPPORT_WHATSAPP}</span>
              </a>
            )}

            {/* Not links and not the stores' badge artwork: there is no
                listing to point at yet. Plain text, so nobody taps one
                expecting a store page. */}
            <div className="mt-5">
              <p className="m-0 mb-2 text-[0.75rem] text-[var(--color-night-subtle)]">
                {lang === "ar" ? "تطبيق موعد — قريب" : "The Maw3ed app — coming soon"}
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {["App Store", "Google Play"].map((store) => (
                  <li
                    key={store}
                    className="rounded-[var(--radius-md)] border border-[var(--color-night-edge)] px-3 py-1.5 text-[0.75rem] text-[var(--color-night-text)]"
                  >
                    <span dir="ltr">{store}</span>
                    <span className="ms-1.5 text-[var(--color-night-subtle)]">{lang === "ar" ? "· قريبًا" : "· soon"}</span>
                  </li>
                ))}
              </ul>
            </div>
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
          <p className="m-0 basis-full text-[0.75rem] text-[var(--color-night-subtle)]">{operatorLine(lang === "ar" ? "ar" : "en")}</p>
        </div>
      </div>
    </footer>
  );
}
