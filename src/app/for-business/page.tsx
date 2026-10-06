import type { Metadata } from "next";
import { db } from "@/lib/db";
import ForBusinessContent from "./_components/ForBusinessContent";

export const metadata: Metadata = {
  title: "لأصحاب الأعمال",
  description: "اعرض نشاطك على موعد واستقبل حجوزات أونلاين.",
};

/**
 * The pitch to business owners.
 *
 * A server component only so the social proof can be real: the page
 * used to show three testimonials from people who do not exist. What it
 * shows now is the businesses actually on the platform, read from the
 * database. If there are none, the section does not render — an empty
 * strip is honest in a way an invented one is not.
 */
export default async function ForBusinessPage() {
  const businesses = await db.business.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 9,
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      logoImage: true,
      category: { select: { nameAr: true } },
      city: { select: { nameAr: true } },
    },
  });

  return (
    <ForBusinessContent
      businesses={businesses.map((b) => ({
        slug: b.slug,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        logoImage: b.logoImage,
        categoryAr: b.category.nameAr,
        cityAr: b.city.nameAr,
      }))}
    />
  );
}
