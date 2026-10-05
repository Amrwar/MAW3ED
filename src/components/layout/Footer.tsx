"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
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
    <footer className="bg-[var(--color-surface)] border-t border-[var(--color-line)]">
      <div className="container-app pt-14 pb-10">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10 mb-11">

          <div className="sm:col-span-2 lg:col-span-1">
            <Logo size="sm" className="mb-4" />
            <p className="max-w-[34ch] text-[0.84375rem] leading-[1.8] text-[var(--color-subtle)]">
              {f.tagline}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-[0.8125rem] font-bold text-[var(--color-ink)]">
                {col.title}
              </h4>
              <ul className="link-list flex flex-col">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.84375rem] text-[var(--color-muted)] hover:text-[var(--color-jade)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[var(--color-line)] pt-6">
          <p className="text-[0.78125rem] text-[var(--color-subtle)]">{f.copyright}</p>
          <p className="text-[0.78125rem] text-[var(--color-subtle)]">{madeIn}</p>
        </div>
      </div>
    </footer>
  );
}
