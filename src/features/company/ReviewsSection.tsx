import { Star, PenLine, ThumbsUp } from "lucide-react";

const MOCK_REVIEWS = [
  {
    id:       "r1",
    name:     "سارة محمود",
    initials: "سم",
    gradient: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
    rating:   5,
    date:     "منذ ٣ أيام",
    verified: true,
    text:     "خدمة ممتازة والدكتور محترف جدًا. الانتظار كان قليل والمكان نظيف جداً ومريح. سهّل عليّ الحجز من خلال التطبيق وجاءت تذكيرات الموعد في الوقت المناسب. أنصح به بشدة.",
  },
  {
    id:       "r2",
    name:     "محمد عبدالله",
    initials: "مع",
    gradient: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
    rating:   5,
    date:     "منذ أسبوع",
    verified: true,
    text:     "أفضل تجربة حجز جربتها. الموعد كان في الوقت المحدد تمامًا وما اضطريتش أنتظر. الدكتور واضح وشارح كل حاجة بالتفصيل. هرجع تاني بالتأكيد.",
  },
  {
    id:       "r3",
    name:     "هدى حسام",
    initials: "هح",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
    rating:   4,
    date:     "منذ ٢ أسابيع",
    verified: false,
    text:     "الخدمة كويسة والتعامل احترافي جداً. كان في تأخير بسيط بس الفريق اعتذر واهتم بالموضوع. المكان نظيف ومرتب. هاحجز تاني.",
  },
];

const RATING_BARS = [
  { star: 5, pct: 75 },
  { star: 4, pct: 18 },
  { star: 3, pct:  4 },
  { star: 2, pct:  2 },
  { star: 1, pct:  1 },
];

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-[#E2E8F0] text-[#E2E8F0]"
          }
        />
      ))}
    </div>
  );
}

export default function ReviewsSection({
  rating,
  reviewCount,
}: {
  rating:      number;
  reviewCount: number;
}) {
  return (
    <div
      id="reviews"
      className="rounded-3xl border p-6 md:p-8"
      style={{
        background:  "#FFFFFF",
        borderColor: "#E2E8F0",
        boxShadow:   "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-6 rounded-full shrink-0"
            style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
          />
          <h2 className="text-xl font-black text-[#0F172A]">التقييمات</h2>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background:  "#F8FAFC",
            border:      "1px solid #E2E8F0",
            color:       "#475569",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#BFDBFE";
            el.style.background  = "#EFF6FF";
            el.style.color       = "#1D4ED8";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#E2E8F0";
            el.style.background  = "#F8FAFC";
            el.style.color       = "#475569";
          }}
        >
          <PenLine size={14} />
          اكتب تقييم
        </button>
      </div>

      {/* Rating summary card */}
      <div
        className="flex items-center gap-6 p-5 rounded-2xl mb-7"
        style={{
          background:  "linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.03) 100%)",
          border:      "1px solid rgba(59,130,246,0.14)",
        }}
      >
        {/* Big number */}
        <div className="text-center shrink-0">
          <p
            className="font-black text-[#0F172A] leading-none mb-2"
            style={{ fontSize: 52 }}
          >
            {rating.toFixed(1)}
          </p>
          <StarRow rating={rating} size={16} />
          <p className="text-xs text-[#94A3B8] mt-2">
            {reviewCount > 0
              ? `${reviewCount.toLocaleString("ar-EG")} تقييم`
              : "لا تقييمات بعد"}
          </p>
        </div>

        {/* Vertical divider */}
        <div className="w-px self-stretch" style={{ background: "rgba(59,130,246,0.15)" }} />

        {/* Bar breakdown */}
        <div className="flex-1 space-y-2">
          {RATING_BARS.map(({ star, pct }) => (
            <div key={star} className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#94A3B8] w-3 shrink-0 text-end">
                {star}
              </span>
              <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "#E2E8F0" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      `${pct}%`,
                    background: "linear-gradient(to left, #F59E0B, #FCD34D)",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <span className="text-xs text-[#94A3B8] w-8 text-start shrink-0">
                {pct}٪
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Review cards */}
      <div className="space-y-4">
        {MOCK_REVIEWS.map((review) => (
          <div
            key={review.id}
            className="p-5 rounded-2xl border transition-all duration-200"
            style={{
              background:  "#FAFBFD",
              borderColor: "#E2E8F0",
              boxShadow:   "0 1px 4px rgba(15,23,42,0.03)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "rgba(147,197,253,0.55)";
              el.style.background  = "#FFFFFF";
              el.style.boxShadow   = "0 4px 16px rgba(59,130,246,0.07)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#E2E8F0";
              el.style.background  = "#FAFBFD";
              el.style.boxShadow   = "0 1px 4px rgba(15,23,42,0.03)";
            }}
          >
            {/* Reviewer header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: review.gradient }}
                >
                  {review.initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#0F172A]">{review.name}</p>
                    {review.verified && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: "#DCFCE7", color: "#15803D" }}
                      >
                        <ThumbsUp size={8} />
                        موثّق
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={review.rating} size={12} />
                  </div>
                </div>
              </div>
              <span className="text-xs text-[#94A3B8] shrink-0 pt-1">{review.date}</span>
            </div>

            {/* Separator */}
            <div className="h-px mb-3" style={{ background: "#F1F5F9" }} />

            {/* Review text */}
            <p className="text-sm text-[#475569] leading-loose">{review.text}</p>
          </div>
        ))}
      </div>

      {/* Load more */}
      <div className="mt-5 text-center">
        <button
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200"
          style={{
            background:  "#F8FAFC",
            border:      "1px solid #E2E8F0",
            color:       "#475569",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#BFDBFE";
            el.style.background  = "#EFF6FF";
            el.style.color       = "#1D4ED8";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#E2E8F0";
            el.style.background  = "#F8FAFC";
            el.style.color       = "#475569";
          }}
        >
          عرض جميع التقييمات
        </button>
      </div>
    </div>
  );
}
