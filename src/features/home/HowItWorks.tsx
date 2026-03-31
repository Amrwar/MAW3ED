import Container from "@/components/ui/Container";

const customerSteps = [
  {
    number: "١",
    icon: "🔍",
    title: "ابحث واختار",
    description: "تصفح مئات الأعمال، فلتر حسب التخصص والمنطقة والتقييم.",
  },
  {
    number: "٢",
    icon: "📅",
    title: "احجز موعدك",
    description: "اختار الخدمة، الوقت المناسب، واحجز في ثوانٍ بدون مكالمات.",
  },
  {
    number: "٣",
    icon: "✅",
    title: "استمتع بالخدمة",
    description: "احصل على تأكيد فوري وتذكير تلقائي قبل موعدك.",
  },
];

const businessSteps = [
  {
    number: "١",
    icon: "🏪",
    title: "أنشئ صفحتك",
    description: "سجّل عملك مجانًا وخصّص صفحتك بخدماتك وأوقاتك.",
  },
  {
    number: "٢",
    icon: "📲",
    title: "شارك رابطك",
    description: "احصل على رابط خاص بعملك وشاركه مع عملائك.",
  },
  {
    number: "٣",
    icon: "📈",
    title: "نمّ عملك",
    description: "تابع حجوزاتك، تواصل مع عملائك، وحلّل أداءك.",
  },
];

function StepCard({
  step,
  color,
}: {
  step: (typeof customerSteps)[0];
  color: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-sm"
        style={{ backgroundColor: color }}
      >
        {step.icon}
      </div>
      <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] text-white text-xs font-black flex items-center justify-center mb-3">
        {step.number}
      </div>
      <h3 className="font-bold text-[var(--color-text-primary)] mb-2">
        {step.title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {step.description}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding">
      <Container>
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="section-eyebrow mb-2">كيف تعمل موعد</p>
          <h2 className="section-title mb-4">بسيط. سريع. فعّال.</h2>
          <p className="section-subtitle mx-auto">
            موعد مصمم ليكون سهلًا للعملاء وقويًا للأعمال في نفس الوقت.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* For customers */}
          <div className="bg-[var(--color-surface-2)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-base">
                👤
              </div>
              <h3 className="font-bold text-[var(--color-text-primary)]">
                للعملاء
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
              {/* Connector line */}
              <div className="hidden sm:block absolute top-8 start-[16.67%] end-[16.67%] h-0.5 bg-[var(--color-border)]" />
              {customerSteps.map((step) => (
                <StepCard key={step.number} step={step} color="#EFF6FF" />
              ))}
            </div>
          </div>

          {/* For businesses */}
          <div className="bg-[var(--color-brand)] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-base">
                🏢
              </div>
              <h3 className="font-bold text-white">للأعمال</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
              <div className="hidden sm:block absolute top-8 start-[16.67%] end-[16.67%] h-0.5 bg-white/20" />
              {businessSteps.map((step) => (
                <div
                  key={step.number}
                  className="flex flex-col items-center text-center p-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl mb-4">
                    {step.icon}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white text-[var(--color-brand)] text-xs font-black flex items-center justify-center mb-3">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
