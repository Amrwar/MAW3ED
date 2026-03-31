import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = { title: "سياسة الخصوصية | موعد" };

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container-app max-w-3xl">
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] mb-2">
            سياسة الخصوصية
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">
            آخر تحديث: مارس ٢٠٢٥
          </p>

          <div className="prose prose-sm max-w-none space-y-8 text-[var(--color-text-secondary)] leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">١. البيانات التي نجمعها</h2>
              <p>
                نجمع المعلومات التي تقدمها عند إنشاء حساب (الاسم، البريد الإلكتروني)، ومعلومات العمل التجاري، وبيانات الحجوزات التي تتم عبر المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">٢. كيف نستخدم بياناتك</h2>
              <p>
                نستخدم بياناتك لتشغيل الخدمة، وتحسين تجربة المستخدم، وإرسال إشعارات المواعيد، والتواصل معك بشأن حسابك. لا نبيع بياناتك لأطراف ثالثة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">٣. حفظ البيانات</h2>
              <p>
                يتم تخزين بياناتك على خوادم آمنة. نستخدم تشفير SSL لحماية البيانات أثناء النقل ونطبق معايير الأمان الحديثة لحماية بياناتك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">٤. ملفات تعريف الارتباط</h2>
              <p>
                نستخدم ملفات الكوكيز لتحسين تجربتك وتذكر تسجيل دخولك. يمكنك التحكم في إعدادات الكوكيز من خلال متصفحك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">٥. حقوقك</h2>
              <p>
                يحق لك الوصول إلى بياناتك الشخصية، وطلب تصحيحها أو حذفها في أي وقت. تواصل معنا عبر البريد الإلكتروني لممارسة هذه الحقوق.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">٦. التواصل</h2>
              <p>
                لأي استفسارات حول سياسة الخصوصية، تواصل معنا عبر البريد الإلكتروني.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--color-border)]">
            <Link href="/" className="text-sm text-[var(--color-accent)] hover:underline">
              ← العودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
