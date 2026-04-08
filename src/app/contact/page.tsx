import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { Mail, Phone, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "تواصل معنا | موعد",
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">نحن هنا</p>
              <h1 className="section-title mb-4">تواصل معنا</h1>
              <p className="section-subtitle mx-auto">
                فريق دعم موعد جاهز لمساعدتك في أي وقت.
              </p>
            </div>
          </Container>
        </section>

        <section className="section-padding">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {[
                {
                  icon: Mail,
                  color: "bg-blue-50 text-blue-600",
                  title: "البريد الإلكتروني",
                  value: "support@maw3ed.com",
                  sub: "نرد خلال ٢٤ ساعة",
                },
                {
                  icon: Phone,
                  color: "bg-green-50 text-green-600",
                  title: "الهاتف",
                  value: "+20 100 000 0000",
                  sub: "السبت – الخميس، ٩ص – ٥م",
                },
                {
                  icon: MessageCircle,
                  color: "bg-purple-50 text-purple-600",
                  title: "واتساب",
                  value: "تواصل عبر واتساب",
                  sub: "ردود سريعة",
                },
              ].map((item) => (
                <div key={item.title} className="card p-6 text-center">
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-4`}>
                    <item.icon size={22} />
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm font-medium text-[var(--color-accent)] mb-1">
                    {item.value}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.sub}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
