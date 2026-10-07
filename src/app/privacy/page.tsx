import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/meta";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = buildMetadata({
  title: "سياسة الخصوصية",
  description: "إزاي موعد بيجمع بياناتك ويستخدمها ويحميها.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="pt-24 pb-16">
        <div className="container-app max-w-3xl">
          <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] mb-2">
            سياسة الخصوصية
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">
            آخر تحديث: مارس 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-8 text-[var(--color-text-secondary)] leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">1. البيانات التي نجمعها</h2>
              <p>
                نجمع المعلومات التي تقدمها عند إنشاء حساب (الاسم، البريد الإلكتروني)، ومعلومات العمل التجاري، وبيانات الحجوزات التي تتم عبر المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">2. كيف نستخدم بياناتك</h2>
              <p>
                نستخدم بياناتك لتشغيل الخدمة، وتحسين تجربة المستخدم، وإرسال إشعارات المواعيد، والتواصل معك بشأن حسابك. لا نبيع بياناتك لأطراف ثالثة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">3. حفظ البيانات</h2>
              <p>
                يتم تخزين بياناتك على خوادم آمنة. نستخدم تشفير SSL لحماية البيانات أثناء النقل ونطبق معايير الأمان الحديثة لحماية بياناتك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">4. ملفات تعريف الارتباط</h2>
              <p>
                نستخدم ملفات الكوكيز لتحسين تجربتك وتذكر تسجيل دخولك. يمكنك التحكم في إعدادات الكوكيز من خلال متصفحك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">5. حقوقك</h2>
              <p>
                يحق لك الوصول إلى بياناتك الشخصية، وطلب تصحيحها أو حذفها في أي وقت. تواصل معنا عبر البريد الإلكتروني لممارسة هذه الحقوق.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">6. التواصل</h2>
              <p>
                لأي استفسارات حول سياسة الخصوصية، تواصل معنا عبر البريد الإلكتروني.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--color-line)]">
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-[var(--color-jade)] hover:underline">
              ← العودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
