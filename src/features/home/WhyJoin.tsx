import Container from "@/components/ui/Container";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

const benefits = [
  {
    icon: "📲",
    title: "رابط حجز مخصص",
    description: "احصل على رابطك الخاص مثل maw3ed.com/company/اسمك وشاركه في كل مكان.",
  },
  {
    icon: "🗓️",
    title: "إدارة ذكية للمواعيد",
    description: "لوحة تحكم سهلة لإدارة جميع حجوزاتك، تأكيدها أو إلغائها بنقرة.",
  },
  {
    icon: "🔔",
    title: "تذكيرات تلقائية",
    description: "موعد يرسل تذكيرات للعملاء تلقائيًا، فتقل حالات الغياب بشكل ملحوظ.",
  },
  {
    icon: "📊",
    title: "تقارير وإحصائيات",
    description: "تابع أداء عملك، الأكثر طلبًا، أوقات الذروة، ونمو العملاء.",
  },
  {
    icon: "⭐",
    title: "صفحة احترافية",
    description: "صفحتك على موعد تظهر كأنك شركة كبيرة — معلومات، خدمات، تقييمات.",
  },
  {
    icon: "🆓",
    title: "ابدأ مجانًا",
    description: "لا رسوم خفية، لا التزام. جرّب موعد مجانًا وانضم لمئات الأعمال.",
  },
];

const bullets = [
  "إعداد سهل في ٥ دقائق",
  "بدون تقنية أو خبرة مطلوبة",
  "دعم عربي على مدار الساعة",
  "تحديثات مستمرة بدون تكلفة إضافية",
];

export default function WhyJoin() {
  return (
    <section className="section-padding bg-[var(--color-surface-2)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <p className="section-eyebrow mb-2">لماذا موعد؟</p>
            <h2 className="section-title mb-4">
              حوّل عملك لتجربة
              <br />
              <span className="gradient-text">رقمية احترافية</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base leading-relaxed mb-8">
              سواء كنت صاحب عيادة، صالون، جيم، أو أي خدمة — موعد يعطيك الأدوات
              الاحترافية للنمو والتنظيم.
            </p>

            <ul className="space-y-2.5 mb-8">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5">
                  <CheckCircle size={17} className="text-green-500 shrink-0" />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {b}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="btn btn-primary btn-lg">
                ابدأ مجانًا الآن
              </Link>
              <Link href="/signup" className="btn btn-outline btn-lg">
                شاهد العرض التوضيحي
              </Link>
            </div>
          </div>

          {/* Right: benefit cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="card p-5 hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200"
              >
                <div className="text-2xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1.5">
                  {b.title}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
