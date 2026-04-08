"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Star, BadgeCheck } from "lucide-react";

// ─── Static data ────────────────────────────────────────────

const TRUST_STATS = [
  { en: "500+ Businesses",   ar: "٥٠٠+ نشاط تجاري"  },
  { en: "10,000+ Bookings",  ar: "١٠,٠٠٠+ حجز"       },
  { en: "4.9 ★ Rating",      ar: "٤.٩ ★ تقييم"        },
  { en: "24/7 Support",      ar: "دعم على مدار الساعة" },
];

const TESTIMONIALS = [
  {
    nameAr:     "د. سارة محمود",
    nameEn:     "Dr. Sara Mahmoud",
    roleAr:     "عيادة أسنان",
    roleEn:     "Dental Clinic",
    locationAr: "المهندسين، القاهرة",
    locationEn: "Mohandessin, Cairo",
    textAr:     "موعد غيّر طريقة إدارة عيادتي تمامًا. الحجوزات بقت منظمة وما فيش حجوزات فايتة، والتذكيرات التلقائية وفّرت عليّ ساعات كل أسبوع.",
    textEn:     "Maw3ed completely changed how I manage my clinic. Bookings are organized, nothing falls through the cracks, and automatic reminders save me hours every week.",
    rating:     5,
    initials:   "سم",
    gradient:   "linear-gradient(135deg, #0369A1 0%, #38BDF8 100%)",
    featured:   false,
  },
  {
    nameAr:     "أحمد كمال",
    nameEn:     "Ahmed Kamal",
    roleAr:     "صالون حلاقة",
    roleEn:     "Barbershop",
    locationAr: "المعادي، القاهرة",
    locationEn: "Maadi, Cairo",
    textAr:     "من لحظة ما فتحت صفحتي على موعد، الحجوزات بدأت تجيني تلقائيًا. العملاء بيحجزوا على طول من غير ما يكلموني، وده وفّر عليّ وقت كتير جدًا.",
    textEn:     "From the moment I listed my shop on Maw3ed, bookings started coming in automatically. Customers book on their own without calling, which saves me so much time.",
    rating:     5,
    initials:   "أك",
    gradient:   "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)",
    featured:   true,
  },
  {
    nameAr:     "منى السيد",
    nameEn:     "Mona El-Sayed",
    roleAr:     "مركز ليزر وتجميل",
    roleEn:     "Laser & Beauty Center",
    locationAr: "التجمع الخامس",
    locationEn: "New Cairo",
    textAr:     "التقارير والإحصائيات ساعدتني أفهم ساعات الذروة وأنظم فريقي بشكل أفضل. لوحة التحكم بسيطة ومريحة حتى لو ما عندكيش خبرة تقنية.",
    textEn:     "The analytics helped me understand peak hours and organize my team better. The dashboard is simple and comfortable even without technical experience.",
    rating:     5,
    initials:   "مس",
    gradient:   "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)",
    featured:   false,
  },
];

// ─── Stars ──────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────

export default function Testimonials() {
  const { t, lang } = useLanguage();
  const t2 = t.testimonials;
  const isAr = lang === "ar";

  const verifiedLabel = isAr ? "نشاط موثّق" : "Verified Business";
  const trustLine     = isAr
    ? "يثق بنا مئات الأعمال في أنحاء مصر"
    : "Trusted by businesses across Egypt";

  return (
    <section
      className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: "#FFFFFF" }}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* ── Subtle background ── */}
      {/* Top radial glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-10%", left: "50%", transform: "translateX(-50%)",
          width: 900, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.055) 0%, transparent 65%)",
          filter: "blur(2px)",
        }}
      />
      {/* Bottom fade to #F8FAFC */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #F8FAFC)" }}
      />

      <div className="relative z-10 container-app">

        {/* ── Section header ── */}
        <div className="text-center mb-10">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-[#DBEAFE] border border-[#BFDBFE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span className="text-[#3B82F6] text-xs font-semibold tracking-widest uppercase">
              {t2.eyebrow}
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] mb-4"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
          >
            {t2.title}
          </h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto mb-3" style={{ lineHeight: 1.75 }}>
            {t2.subtitle}
          </p>
          <p className="text-sm text-[#94A3B8] font-medium">{trustLine}</p>
        </div>

        {/* ── Trust stats row ── */}
        <div className="flex flex-wrap justify-center gap-3 mb-14">
          {TRUST_STATS.map((s) => (
            <div
              key={s.en}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-[#475569]"
              style={{
                background: "#F8FAFC",
                border:     "1px solid #E2E8F0",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "#3B82F6", boxShadow: "0 0 5px rgba(59,130,246,0.5)" }}
              />
              {isAr ? s.ar : s.en}
            </div>
          ))}
        </div>

        {/* ── Testimonial cards ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {TESTIMONIALS.map((review) => {
            const name     = isAr ? review.nameAr     : review.nameEn;
            const role     = isAr ? review.roleAr     : review.roleEn;
            const location = isAr ? review.locationAr : review.locationEn;
            const text     = isAr ? review.textAr     : review.textEn;

            const shadow      = review.featured
              ? "0 8px 36px rgba(59,130,246,0.14), 0 2px 10px rgba(59,130,246,0.08)"
              : "0 2px 14px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)";
            const shadowHover = review.featured
              ? "0 18px 56px rgba(59,130,246,0.20), 0 6px 18px rgba(59,130,246,0.10)"
              : "0 10px 36px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)";
            const border      = review.featured ? "1.5px solid rgba(59,130,246,0.35)" : "1px solid #E2E8F0";
            const borderHover = review.featured ? "1.5px solid rgba(59,130,246,0.55)" : "1px solid rgba(59,130,246,0.25)";

            return (
              <div
                key={review.nameEn}
                className="relative flex flex-col rounded-3xl p-7 transition-all duration-300 cursor-default"
                style={{
                  background: "#FFFFFF",
                  border,
                  boxShadow: shadow,
                  ...(review.featured ? { transform: "translateY(-6px)" } : {}),
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = shadowHover;
                  el.style.border    = borderHover;
                  el.style.transform = review.featured ? "translateY(-10px)" : "translateY(-5px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = shadow;
                  el.style.border    = border;
                  el.style.transform = review.featured ? "translateY(-6px)" : "translateY(0)";
                }}
              >

                {/* Decorative quote mark */}
                <div
                  aria-hidden
                  className="absolute top-5 end-6 font-serif select-none pointer-events-none"
                  style={{
                    fontSize:   "5rem",
                    lineHeight: 1,
                    color:      review.featured ? "rgba(59,130,246,0.10)" : "rgba(15,23,42,0.05)",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  "
                </div>

                {/* Stars */}
                <div className="mb-4">
                  <Stars n={review.rating} />
                </div>

                {/* Review text */}
                <p
                  className="text-[#475569] leading-relaxed flex-1 mb-6"
                  style={{ fontSize: "0.9375rem", lineHeight: 1.75 }}
                >
                  {text}
                </p>

                {/* Divider */}
                <div className="border-t border-[#F1F5F9] mb-5" />

                {/* Identity area */}
                <div className="flex items-center gap-3">

                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 select-none"
                    style={{ background: review.gradient }}
                  >
                    {review.initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0F172A] truncate">{name}</p>
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                      {role} · {location}
                    </p>
                  </div>

                  {/* Verified badge */}
                  <div
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full"
                    style={{
                      background: "rgba(59,130,246,0.07)",
                      border:     "1px solid rgba(59,130,246,0.18)",
                    }}
                    title={verifiedLabel}
                  >
                    <BadgeCheck size={12} strokeWidth={2} className="text-[#3B82F6]" />
                    <span className="text-[10px] font-semibold text-[#3B82F6] hidden sm:block">
                      {t2.badgeBusiness}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Navigation dots ── */}
        <div className="flex items-center justify-center gap-2 mt-10">
          {TESTIMONIALS.map((review, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width:      review.featured ? 24 : 8,
                height:     8,
                background: review.featured ? "#3B82F6" : "#E2E8F0",
              }}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
