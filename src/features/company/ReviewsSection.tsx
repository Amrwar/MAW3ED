import StarRating from "@/components/shared/StarRating";
import Button from "@/components/ui/Button";

const mockReviews = [
  {
    id: "r1",
    name: "سارة محمود",
    initials: "س م",
    rating: 5,
    date: "منذ ٣ أيام",
    text: "خدمة ممتازة والدكتور محترف جدًا. الانتظار كان قليل والمكان نظيف. أنصح به بشدة.",
  },
  {
    id: "r2",
    name: "محمد عبدالله",
    initials: "م ع",
    rating: 5,
    date: "منذ أسبوع",
    text: "أفضل تجربة حجز جربتها. الموعد كان في الوقت المحدد تمامًا وما اضطريتش أنتظر.",
  },
  {
    id: "r3",
    name: "هدى حسام",
    initials: "ه ح",
    rating: 4,
    date: "منذ ٢ أسابيع",
    text: "الخدمة كويسة والتعامل احترافي. بس كان في تأخير بسيط. هاحجز تاني.",
  },
];

interface ReviewsSectionProps {
  rating: number;
  reviewCount: number;
}

export default function ReviewsSection({
  rating,
  reviewCount,
}: ReviewsSectionProps) {
  return (
    <div className="py-8 border-b border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-[var(--color-text-primary)]">
          التقييمات
        </h2>
        <Button variant="outline" size="sm">
          اكتب تقييم
        </Button>
      </div>

      {/* Rating summary */}
      <div className="flex items-center gap-6 p-5 bg-[var(--color-surface-2)] rounded-2xl mb-6">
        <div className="text-center shrink-0">
          <p className="text-5xl font-black text-[var(--color-text-primary)]">
            {rating.toFixed(1)}
          </p>
          <StarRating rating={rating} showCount={false} size="sm" className="justify-center mt-1" />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {reviewCount} تقييم
          </p>
        </div>

        {/* Bar chart */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star, i) => {
            const pct = [75, 18, 4, 2, 1][i];
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-muted)] w-3 shrink-0">
                  {star}
                </span>
                <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[var(--color-text-muted)] w-8 text-end">
                  {pct}٪
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {mockReviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-sm font-bold text-[var(--color-text-secondary)] shrink-0">
                {r.initials}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {r.name}
                  </p>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {r.date}
                  </span>
                </div>
                <StarRating rating={r.rating} showCount={false} size="sm" className="mb-2" />
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {r.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
