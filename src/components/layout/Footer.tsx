import Link from "next/link";
import Logo from "@/components/shared/Logo";

const footerLinks = {
  platform: {
    title: "المنصة",
    links: [
      { label: "الرئيسية",     href: "/" },
      { label: "تصفح الأعمال", href: "/businesses" },
      { label: "الفئات",       href: "/categories" },
      { label: "المدن",        href: "/cities" },
      { label: "الأسعار",      href: "/pricing" },
    ],
  },
  business: {
    title: "للشركات",
    links: [
      { label: "للشركات",      href: "/for-business" },
      { label: "أضف نشاطك",   href: "/signup?type=business" },
      { label: "إنشاء حساب",   href: "/signup" },
      { label: "تسجيل الدخول", href: "/login" },
    ],
  },
  support: {
    title: "الدعم",
    links: [
      { label: "تواصل معنا",       href: "/contact" },
      { label: "الأسئلة الشائعة",   href: "/faq" },
      { label: "سياسة الخصوصية",   href: "/privacy" },
      { label: "الشروط والأحكام",   href: "/terms" },
    ],
  },
};

export default function Footer() {
  return (
    <footer className="bg-[var(--color-brand)] text-white">
      {/* Main footer body */}
      <div className="container-app py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1 — Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo variant="white" size="md" className="mb-4" />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              منصة لحجز المواعيد واكتشاف الأعمال والخدمات بسهولة في مصر.
            </p>
          </div>

          {/* Columns 2-4 — Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h4 className="text-sm font-semibold text-white mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
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

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-app py-4 flex items-center justify-center text-xs text-gray-500">
          <span>© 2026 Maw3ed. جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
}
