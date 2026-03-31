import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { categories } from "@/data/categories";

const footerLinks = {
  platform: {
    title: "المنصة",
    links: [
      { label: "من نحن", href: "/about" },
      { label: "كيف تعمل موعد", href: "/#how-it-works" },
      { label: "الأسعار", href: "/pricing" },
      { label: "المدونة", href: "/blog" },
    ],
  },
  businesses: {
    title: "للأعمال",
    links: [
      { label: "أنشئ صفحتك", href: "/dashboard" },
      { label: "لوحة التحكم", href: "/dashboard" },
      { label: "نجاحات العملاء", href: "/#testimonials" },
      { label: "الشراكات", href: "/partners" },
    ],
  },
  support: {
    title: "الدعم",
    links: [
      { label: "مركز المساعدة", href: "/help" },
      { label: "تواصل معنا", href: "/contact" },
      { label: "سياسة الخصوصية", href: "/privacy" },
      { label: "شروط الاستخدام", href: "/terms" },
    ],
  },
};

export default function Footer() {
  return (
    <footer className="bg-[var(--color-brand)] text-white">
      {/* Main Footer */}
      <div className="container-app py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Logo variant="white" size="md" className="mb-4" />
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mb-6">
              منصة موعد — الحل الأذكى للحجز في مصر. ربط الأعمال بالعملاء في ثوانٍ.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {["فيسبوك", "إنستغرام", "تويتر"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-gray-300 transition-colors"
                >
                  {s[0]}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h4 className="text-sm font-semibold text-white mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Top categories */}
        <div className="mt-10 pt-8 border-t border-white/10">
          <p className="text-xs text-gray-500 mb-3">الأقسام الأكثر طلبًا:</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/?category=${cat.slug}`}
                className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1 rounded-full transition-colors"
              >
                {cat.icon} {cat.nameAr}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-app py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} موعد — MAW3ED. جميع الحقوق محفوظة.</span>
          <span>صُنع بـ ❤️ في مصر</span>
        </div>
      </div>
    </footer>
  );
}
