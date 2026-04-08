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

  return (
    <footer style={{ background: "#0F172A" }}>
      <div className="container-app pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo variant="white" size="sm" className="mb-5" />
            <p className="text-[#94A3B8] text-sm leading-relaxed max-w-xs">
              {f.tagline}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#3B82F6]/15 text-[#93C5FD] border border-[#3B82F6]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
                متاح على مدار الساعة
              </span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#94A3B8] hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mb-8" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#475569]">{f.copyright}</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-[#475569] hover:text-[#94A3B8] transition-colors">
              {f.links.privacy}
            </Link>
            <Link href="/terms" className="text-xs text-[#475569] hover:text-[#94A3B8] transition-colors">
              {f.links.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
