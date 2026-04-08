"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "د. سارة محمود",
    role: "عيادة أسنان · المهندسين",
    avatar: "👩‍⚕️",
    text: "موعد غيّر طريقة إدارة عيادتي تمامًا. الحجوزات بقت منظمة وما فيش حجوزات فايتة.",
    rating: 5,
  },
  {
    name: "أحمد كمال",
    role: "صالون حلاقة · المعادي",
    avatar: "💈",
    text: "من لحظة ما فتحت صفحتي على موعد، الحجوزات بدأت تجيني تلقائيًا. ممتاز جدًا!",
    rating: 5,
  },
  {
    name: "منى السيد",
    role: "مركز ليزر وتجميل · التجمع",
    avatar: "✨",
    text: "التقارير والإحصائيات ساعدتني أفهم ساعات الذروة وأنظم فريقي بشكل أفضل.",
    rating: 5,
  },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const { t, lang } = useLanguage();
  const t2 = t.testimonials;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#FFFFFF" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-4 tracking-wide uppercase">
            {t2.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3">{t2.title}</h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto">{t2.subtitle}</p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t3) => (
            <div
              key={t3.name}
              className="p-7 rounded-2xl border border-[#E2E8F0] bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Stars n={t3.rating} />
              <p className="text-[#475569] text-sm leading-relaxed mt-4 mb-5">&ldquo;{t3.text}&rdquo;</p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-xl shrink-0">
                  {t3.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{t3.name}</p>
                  <p className="text-xs text-[#94A3B8]">{t3.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
