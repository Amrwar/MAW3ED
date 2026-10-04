"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const channelIcons = [Mail, Phone, MessageCircle];
const channelColors = ["bg-[var(--color-jade-soft)] text-[var(--color-jade)]","bg-[var(--color-ok-soft)] text-[var(--color-ok)]","bg-[var(--color-jade-soft)] text-[var(--color-jade)]"];

export default function ContactPage() {
  const { t } = useLanguage();
  const c = t.contact;

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {c.channels.map((channel, i) => {
                const Icon = channelIcons[i];
                return (
                  <div key={channel.title} className="card p-6 text-center">
                    <div className={`w-12 h-12 rounded-xl ${channelColors[i]} flex items-center justify-center mx-auto mb-4`}>
                      <Icon size={22} />
                    </div>
                    <h3 className="font-bold text-[var(--color-text-primary)] mb-1">{channel.title}</h3>
                    <p className="text-sm font-medium text-[var(--color-accent)] mb-1">{channel.value}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{channel.sub}</p>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
