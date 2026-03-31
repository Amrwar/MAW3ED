import Container from "@/components/ui/Container";

const stats = [
  {
    value: "٣٠٠+",
    label: "عمل موثّق",
    description: "عيادات، صالونات، مراكز",
    icon: "🏢",
  },
  {
    value: "١٢ألف+",
    label: "حجز مكتمل",
    description: "خلال آخر ٣ أشهر",
    icon: "✅",
  },
  {
    value: "٩٨٪",
    label: "نسبة الرضا",
    description: "من تقييمات العملاء",
    icon: "⭐",
  },
  {
    value: "٤ دقائق",
    label: "وقت الحجز",
    description: "متوسط وقت إتمام الحجز",
    icon: "⚡",
  },
];

export default function TrustStats() {
  return (
    <section className="py-16 bg-[var(--color-surface-2)] border-y border-[var(--color-border)]">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <p className="text-3xl font-black text-[var(--color-text-primary)] mb-1">
                {stat.value}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)] text-sm mb-0.5">
                {stat.label}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
