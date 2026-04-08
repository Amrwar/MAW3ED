"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
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
        { label: f.links.forBusiness,  href: "/for-business" },
        { label: f.links.addBusiness,  href: "/signup?type=business" },
        { label: f.links.signup,       href: "/signup" },
        { label: f.links.login,        href: "/login" },
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

  return (
    <footer className="bg-[var(--color-brand)] text-white">
      <div className="container-app py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1 — Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo variant="white" size="md" className="mb-4" />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              {f.tagline}
            </p>
          </div>

          {/* Columns 2-4 */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-app py-4 flex items-center justify-center text-xs text-gray-500">
          <span>{f.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
