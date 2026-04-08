import Link from "next/link";
import Container from "@/components/ui/Container";
import { Check, Zap, Star, Crown } from "lucide-react";

const plans = [
  {
    name: "مجاني",
    nameEn: "Free",
    price: "٠",
    period: "للأبد",
    icon: Star,
    color: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-[var(--color-border)]",
    cta: "ابدأ مجانًا",
    ctaHref: "/signup",
    ctaClass: "btn btn-outline w-full",
    features: [
      "صفحة احترافية للنشاط",
      "حتى ٣٠ حجزًا شهريًا",
      "رابط حجز خاص",
      "إدارة المواعيد",
    ],
    highlight: false,
  },
  {
    name: "النمو",
    nameEn: "Growth",
    price: "٢٩٩",
    period: "جنيه / شهر",
    icon: Zap,
    color: "text-blue-600",
    bg: "bg-blue-600",
    border: "border-blue-500",
    badge: "الأكثر طلبًا",
    cta: "ابدأ بالنمو",
    ctaHref: "/signup",
    ctaClass: "btn w-full bg-white text-blue-600 font-bold hover:bg-blue-50",
    features: [
      "صفحة احترافية للنشاط",
      "حجوزات غير محدودة",
      "تذكيرات واتساب تلقائية",
      "لوحة إحصائيات متقدمة",
    ],
    highlight: true,
  },
  {
    name: "الاحترافي",
    nameEn: "Pro",
    price: "٤٩٩",
    period: "جنيه / شهر",
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-300",
    cta: "الترقية للاحترافي",
    ctaHref: "/pricing",
    ctaClass: "btn w-full bg-amber-500 text-white hover:bg-amber-600",
    features: [
      "كل ميزات النمو",
      "دفع العربون من العملاء",
      "إخفاء شعار موعد",
      "دعم أولوية",
    ],
    highlight: false,
  },
];

export default function PricingPreview() {
  return (
    <section className="section-padding">
      <Container>
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="section-eyebrow mb-2">الأسعار</p>
          <h2 className="section-title mb-4">خطط تناسب كل عمل</h2>
          <p className="section-subtitle mx-auto">
            ابدأ مجانًا ورقّ مع نمو نشاطك. لا التزامات، لا رسوم خفية.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.nameEn}
              className={`relative rounded-2xl border-2 ${plan.border} overflow-hidden transition-all duration-200 ${
                plan.highlight
                  ? `${plan.bg} shadow-xl shadow-blue-100`
                  : "bg-white hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div className="absolute top-0 inset-x-0 bg-blue-600 text-white text-xs font-bold text-center py-1.5">
                  {plan.badge}
                </div>
              )}

              <div className={`p-6 ${plan.badge ? "pt-10" : ""}`}>
                {/* Icon + name */}
                <div className="flex items-center gap-2 mb-4">
                  <plan.icon
                    size={18}
                    className={plan.highlight ? "text-white" : plan.color}
                  />
                  <span
                    className={`font-bold text-sm ${
                      plan.highlight ? "text-white" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {plan.name}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-3xl font-black ${
                        plan.highlight ? "text-white" : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {plan.price}
                    </span>
                    <span
                      className={`text-sm ${
                        plan.highlight ? "text-blue-100" : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check
                        size={14}
                        className={`shrink-0 ${
                          plan.highlight ? "text-blue-100" : "text-green-500"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          plan.highlight ? "text-blue-100" : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={plan.ctaHref} className={plan.ctaClass}>
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Link to full pricing */}
        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            شاهد المقارنة الكاملة بين الخطط ←
          </Link>
        </div>
      </Container>
    </section>
  );
}
