"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft } from "lucide-react";

type Category = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  color: string;
  bgColor: string;
  iconSvg?: string;
};

interface Props {
  categories: Category[];
}

export default function CategoriesSection({ categories }: Props) {
  const { t, lang } = useLanguage();
  const c = t.categories;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#FFFFFF" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-3 tracking-wide uppercase">
              {c.eyebrow}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A]">{c.title}</h2>
          </div>
          <Link
            href="/categories"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            {c.viewAll}
            <ArrowLeft size={15} />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/businesses?category=${cat.slug}`}
              className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#3B82F6]/50 hover:bg-[#F8FAFC] hover:shadow-md hover:-translate-y-0.5 transition-all text-center"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
                style={{ background: cat.bgColor || "#F1F5F9" }}
              >
                {cat.iconSvg ? (
                  <Image
                    src={cat.iconSvg}
                    alt={lang === "en" ? cat.nameEn : cat.nameAr}
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                ) : (
                  <span>{cat.icon}</span>
                )}
              </div>
              <span className="text-sm font-semibold text-[#0F172A] group-hover:text-[#3B82F6] transition-colors leading-snug">
                {lang === "en" ? cat.nameEn : cat.nameAr}
              </span>
            </Link>
          ))}
        </div>

        {/* Mobile view-all */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            {c.viewAll}
            <ArrowLeft size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
