"use client";

import Container from "@/components/ui/Container";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HowItWorks() {
  const { t } = useLanguage();
  const h = t.howItWorks;

  return (
    <section id="how-it-works" className="section-padding">
      <Container>
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="section-eyebrow mb-2">{h.eyebrow}</p>
          <h2 className="section-title mb-4">{h.title}</h2>
          <p className="section-subtitle mx-auto">{h.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* For customers */}
          <div className="bg-[var(--color-surface-2)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-base">👤</div>
              <h3 className="font-bold text-[var(--color-text-primary)]">{h.forCustomers}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
              <div className="hidden sm:block absolute top-8 start-[16.67%] end-[16.67%] h-0.5 bg-[var(--color-border)]" />
              {h.customerSteps.map((step) => (
                <div key={step.number} className="flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl mb-4 shadow-sm">
                    {step.icon}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] text-white text-xs font-black flex items-center justify-center mb-3">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{step.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* For businesses */}
          <div className="bg-[var(--color-brand)] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-base">🏢</div>
              <h3 className="font-bold text-white">{h.forBusinesses}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
              <div className="hidden sm:block absolute top-8 start-[16.67%] end-[16.67%] h-0.5 bg-white/20" />
              {h.businessSteps.map((step) => (
                <div key={step.number} className="flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl mb-4">
                    {step.icon}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white text-[var(--color-brand)] text-xs font-black flex items-center justify-center mb-3">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
