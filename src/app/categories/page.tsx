"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

type Category = {
  id: string; slug: string; nameAr: string; nameEn: string;
  icon: string; bgColor: string;
};

const staticCats: Category[] = [
  { id:"1", slug:"clinics",     nameAr:"عيادات",       nameEn:"Clinics",        icon:"🏥", bgColor:"#F0F9FF" },
  { id:"2", slug:"salons",      nameAr:"صالونات",       nameEn:"Salons",         icon:"✂️", bgColor:"#FDF2F8" },
  { id:"3", slug:"restaurants", nameAr:"مطاعم",         nameEn:"Restaurants",    icon:"🍽️", bgColor:"#FFFBEB" },
  { id:"4", slug:"gyms",        nameAr:"جيم وفيتنس",    nameEn:"Gyms & Fitness", icon:"💪", bgColor:"#ECFDF5" },
  { id:"5", slug:"spas",        nameAr:"سبا وتدليك",    nameEn:"Spa & Massage",  icon:"🧖", bgColor:"#F5F3FF" },
  { id:"6", slug:"dentists",    nameAr:"طب أسنان",      nameEn:"Dentistry",      icon:"🦷", bgColor:"#ECFEFF" },
  { id:"7", slug:"labs",        nameAr:"مختبرات",       nameEn:"Medical Labs",   icon:"🔬", bgColor:"#FEF2F2" },
  { id:"8", slug:"photography", nameAr:"تصوير",         nameEn:"Photography",    icon:"📸", bgColor:"#FFF7ED" },
];

export default function CategoriesPage() {
  const { t, lang } = useLanguage();
  const c = t.categoriesPage;
  const [categories, setCategories] = useState<Category[]>(staticCats);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data) && data.length > 0) setCategories(data);
    }).catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">{c.eyebrow}</p>
              <h1 className="section-title mb-4">{c.title}</h1>
              <p className="section-subtitle mx-auto">{c.subtitle}</p>
            </div>
          </Container>
        </section>

        <section className="section-padding">
          <Container>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/businesses?category=${cat.slug}`}
                  className="card p-6 flex flex-col items-center text-center hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 group"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200"
                    style={{ backgroundColor: cat.bgColor }}
                  >
                    {cat.icon}
                  </div>
                  <h2 className="font-bold text-[var(--color-text-primary)]">
                    {lang === "en" ? (cat.nameEn || cat.nameAr) : cat.nameAr}
                  </h2>
                </Link>
              ))}
            </div>
          </Container>
        </section>

        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">{c.notFoundTitle}</h2>
              <p className="text-[var(--color-text-secondary)] mb-6">{c.notFoundSub}</p>
              <Link href="/businesses" className="btn btn-primary btn-lg">{c.viewAll}</Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
