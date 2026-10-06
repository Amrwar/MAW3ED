import type { Metadata } from "next";
import { Star } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getBusinessReviews, getRatingSummary } from "@/lib/reviews";
import ReviewsClient from "./_components/ReviewsClient";

export const metadata: Metadata = { title: "التقييمات" };

/**
 * What customers said.
 *
 * The nav used to carry a "Reviews — soon" entry that went nowhere,
 * while the reviews themselves were already being written, shown on the
 * public page and counted into the rating. This is the page that was
 * missing, not the data.
 */
export default async function ReviewsPage() {
  const { business } = await requireBusinessPage();

  const [summary, page] = await Promise.all([
    getRatingSummary(business.id),
    getBusinessReviews(business.id, { sort: "recent", take: 50 }),
  ]);

  if (summary.count === 0) {
    return (
      <div className="space-y-5">
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          التقييمات
        </h1>
        <div className="card">
          <EmptyState
            icon={<Star size={24} strokeWidth={1.7} />}
            title="لسه مفيش تقييمات"
            body="أول تقييم هيظهر هنا بعد ما عميل يكمّل موعده ويقيّمه. التقييم بيتبعت تلقائيًا بعد الزيارة."
          />
        </div>
      </div>
    );
  }

  return (
    <ReviewsClient
      summary={summary}
      reviews={page.reviews}
      total={page.matched}
    />
  );
}
