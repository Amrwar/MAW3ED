import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة | موعد",
};

const faqs = [
  {
    q: "ما هو موعد؟",
    a: "موعد هي منصة عربية لحجز المواعيد واكتشاف الأعمال والخدمات في مصر. تربط العملاء بأفضل العيادات والصالونات والمراكز الصحية وغيرها.",
  },
  {
    q: "هل الاستخدام مجاني؟",
    a: "نعم، الاستخدام مجاني للعملاء بشكل كامل. لأصحاب الأعمال، هناك خطة مجانية مع إمكانية الترقية للخطط المدفوعة للحصول على ميزات إضافية.",
  },
  {
    q: "كيف أضيف نشاطي التجاري؟",
    a: "أنشئ حسابًا على موعد، ثم أضف بيانات نشاطك من خدمات وأسعار وأوقات عمل. ستحصل فورًا على صفحة احترافية ورابط حجز خاص بك.",
  },
  {
    q: "هل يمكنني إلغاء الاشتراك في أي وقت؟",
    a: "نعم، يمكنك إلغاء اشتراكك في أي وقت دون أي رسوم إضافية.",
  },
  {
    q: "هل بياناتي آمنة؟",
    a: "نعم، نستخدم أعلى معايير الأمان والتشفير لحماية بياناتك وبيانات عملائك.",
  },
  {
    q: "كيف يتلقى العملاء تأكيد الحجز؟",
    a: "يتلقى العملاء تأكيدًا فوريًا عبر البريد الإلكتروني، وتذكيرًا تلقائيًا قبل موعدهم.",
  },
  {
    q: "هل يعمل موعد على الهاتف المحمول؟",
    a: "نعم، موعد يعمل بشكل كامل على جميع الأجهزة — الهاتف المحمول، التابلت، والكمبيوتر.",
  },
  {
    q: "كيف أتواصل مع فريق الدعم؟",
    a: "يمكنك التواصل معنا عبر صفحة تواصل معنا أو عبر البريد الإلكتروني support@maw3ed.com",
  },
];

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">مساعدة</p>
              <h1 className="section-title mb-4">الأسئلة الشائعة</h1>
              <p className="section-subtitle mx-auto">
                إجابات على أكثر الأسئلة شيوعًا حول موعد.
              </p>
            </div>
          </Container>
        </section>

        <section className="section-padding">
          <Container>
            <div className="max-w-2xl mx-auto space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="card p-6">
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-[var(--color-text-secondary)] mb-4">
                لم تجد إجابة لسؤالك؟
              </p>
              <Link href="/contact" className="btn btn-primary">
                تواصل معنا
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
