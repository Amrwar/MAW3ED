import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import {
  CheckCircle,
  Calendar,
  BarChart3,
  Bell,
  Globe,
  Star,
  Shield,
  Zap,
  Users,
  ArrowLeft,
} from "lucide-react";

export const metadata: Metadata = {
  title: "للشركات والأعمال | موعد",
  description: "أضف نشاطك التجاري على موعد واستقبل حجوزات من عملائك بسهولة.",
};

const benefits = [
  {
    icon: Globe,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "صفحة احترافية مجانًا",
    description: "صفحة عرض خاصة بنشاطك تضم خدماتك وأوقات عملك وصورك بشكل احترافي.",
  },
  {
    icon: Calendar,
    color: "text-green-500",
    bg: "bg-green-50",
    title: "إدارة ذكية للمواعيد",
    description: "لوحة تحكم سهلة لاستقبال وتأكيد وإلغاء الحجوزات من مكان واحد.",
  },
  {
    icon: Bell,
    color: "text-purple-500",
    bg: "bg-purple-50",
    title: "تذكيرات تلقائية للعملاء",
    description: "موعد يرسل تذكيرات للعملاء تلقائيًا فتقل حالات الغياب بشكل كبير.",
  },
  {
    icon: BarChart3,
    color: "text-orange-500",
    bg: "bg-orange-50",
    title: "تقارير وإحصائيات",
    description: "تابع أداء نشاطك، أكثر الخدمات طلبًا، أوقات الذروة، ونمو العملاء.",
  },
  {
    icon: Users,
    color: "text-pink-500",
    bg: "bg-pink-50",
    title: "قاعدة عملاء موحّدة",
    description: "سجل بيانات عملائك وتواصل معهم بسهولة في مكان واحد.",
  },
  {
    icon: Shield,
    color: "text-teal-500",
    bg: "bg-teal-50",
    title: "آمن وموثوق",
    description: "بياناتك وبيانات عملائك محمية بأعلى معايير الأمان.",
  },
];

const steps = [
  {
    number: "١",
    title: "سجّل نشاطك",
    description: "أنشئ حسابك مجانًا وأدخل بيانات نشاطك التجاري في أقل من ٥ دقائق.",
  },
  {
    number: "٢",
    title: "خصّص صفحتك",
    description: "أضف خدماتك وأسعارها وأوقات عملك وصورك لجذب العملاء.",
  },
  {
    number: "٣",
    title: "شارك رابطك",
    description: "احصل على رابط خاص بنشاطك وشاركه في وسائل التواصل الاجتماعي.",
  },
  {
    number: "٤",
    title: "استقبل الحجوزات",
    description: "ابدأ في استقبال الحجوزات من عملائك بشكل فوري وتلقائي.",
  },
];

const testimonials = [
  {
    name: "د. أحمد محمد",
    role: "طبيب أسنان — القاهرة",
    quote: "موعد غير طريقة عملي تمامًا. الحجوزات الإلكترونية وفّرت وقتًا كبيرًا وقللت حالات الغياب بنسبة ٤٠٪.",
  },
  {
    name: "سارة علي",
    role: "صاحبة صالون تجميل — الجيزة",
    quote: "قبل موعد كنا نضيع ساعات في تنظيم المواعيد. الآن كل شيء منظم تلقائيًا والعملاء سعداء.",
  },
  {
    name: "كريم أشرف",
    role: "مدير جيم — الإسكندرية",
    quote: "الصفحة الاحترافية على موعد ساعدتنا في جذب عملاء جدد لم نكن نصل إليهم من قبل.",
  },
];

const bullets = [
  "إعداد في ٥ دقائق بدون خبرة تقنية",
  "بدون رسوم خفية أو التزامات",
  "دعم عربي على مدار الساعة",
  "تحديثات مستمرة بدون تكلفة إضافية",
  "يعمل على جميع الأجهزة والمتصفحات",
];

export default function ForBusinessPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[var(--color-brand)] text-white py-24">
          <div
            aria-hidden
            className="absolute inset-0 overflow-hidden pointer-events-none"
          >
            <div className="absolute -top-32 -end-32 w-96 h-96 rounded-full bg-white/5" />
            <div className="absolute -bottom-32 -start-32 w-[500px] h-[500px] rounded-full bg-white/5" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>
          <Container>
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-[var(--color-accent)] text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
                <Zap size={14} />
                للشركات والأعمال
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
                نمّ نشاطك مع
                <br />
                <span className="text-[var(--color-accent)]">موعد</span>
              </h1>
              <p className="text-white/70 text-lg md:text-xl leading-relaxed mb-10">
                أضف نشاطك التجاري على موعد واستقبل حجوزات من عملائك إلكترونيًا.
                بدون مكالمات، بدون فوضى، بدون ضياع وقت.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/signup?type=business"
                  className="btn btn-accent btn-lg shadow-lg shadow-[var(--color-accent)]/30"
                >
                  أضف نشاطك مجانًا
                </Link>
                <Link
                  href="/pricing"
                  className="btn btn-outline btn-lg border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                >
                  شاهد الأسعار
                </Link>
              </div>
              <p className="mt-5 text-white/40 text-sm">
                بدون بطاقة ائتمان · إعداد في ٥ دقائق · إلغاء في أي وقت
              </p>
            </div>
          </Container>
        </section>

        {/* Benefits */}
        <section className="section-padding">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">لماذا موعد؟</p>
              <h2 className="section-title mb-4">كل ما تحتاجه لإدارة نشاطك</h2>
              <p className="section-subtitle mx-auto">
                أدوات احترافية مصممة خصيصًا لأصحاب الأعمال في مصر.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="card p-6 hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200"
                >
                  <div className={`w-12 h-12 rounded-xl ${b.bg} flex items-center justify-center mb-4`}>
                    <b.icon size={22} className={b.color} />
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">
                    {b.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {b.description}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">كيف تبدأ</p>
              <h2 className="section-title mb-4">أربع خطوات للانطلاق</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)] text-white text-xl font-black flex items-center justify-center mx-auto mb-4 shadow-sm">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Testimonials */}
        <section className="section-padding">
          <Container>
            <div className="text-center max-w-xl mx-auto mb-14">
              <p className="section-eyebrow mb-2">آراء العملاء</p>
              <h2 className="section-title mb-4">أعمال نجحت مع موعد</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.name} className="card p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                      {t.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {t.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="section-eyebrow mb-2">ابدأ اليوم</p>
                <h2 className="section-title mb-4">
                  جاهز لتنمية نشاطك؟
                </h2>
                <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
                  انضم لمئات الأعمال التي تستخدم موعد لإدارة حجوزاتها وتنمية قاعدة عملائها.
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
                  <Link href="/signup?type=business" className="btn btn-primary btn-lg">
                    أضف نشاطك الآن
                  </Link>
                  <Link href="/pricing" className="btn btn-outline btn-lg">
                    شاهد الأسعار
                  </Link>
                </div>
              </div>

              {/* Pricing teaser */}
              <div className="card p-8 border-2 border-[var(--color-accent)] bg-[var(--color-accent-light)]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-[var(--color-accent)]" />
                  <span className="font-semibold text-[var(--color-accent)] text-sm">الخطة المجانية</span>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-[var(--color-text-primary)]">٠</span>
                  <span className="text-[var(--color-text-secondary)]">جنيه / شهريًا</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                  ابدأ مجانًا وأضف نشاطك دون أي تكلفة. رقّ لاحقًا عندما تنمو.
                </p>
                <Link
                  href="/signup?type=business"
                  className="btn btn-accent w-full mb-3"
                >
                  ابدأ مجانًا
                </Link>
                <Link
                  href="/pricing"
                  className="btn btn-ghost w-full text-[var(--color-accent)]"
                >
                  شاهد جميع الخطط
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
