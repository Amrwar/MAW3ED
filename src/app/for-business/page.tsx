import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";
import { db } from "@/lib/db";
import { getPlatformReach, SHOW_COUNTS_FROM } from "@/lib/data";
import ForBusinessContent from "./_components/ForBusinessContent";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "For business owners",
        description: "List your business on Maw3ed and take bookings online.",
        path: "/for-business",
        lang,
      })
    : buildMetadata({
        title: "لأصحاب الأعمال",
        description: "اعرض نشاطك على موعد واستقبل حجوزات أونلاين.",
        path: "/for-business",
      });
}

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
  const [{ businesses: total }, businesses] = await Promise.all([
    // The homepage's figure, so the two pages agree on when to show it.
    getPlatformReach(),
    db.business.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 9,
      select: {
        slug: true,
        nameAr: true,
        nameEn: true,
        logoImage: true,
        category: { select: { nameAr: true, nameEn: true } },
        city: { select: { nameAr: true, nameEn: true } },
      },
    }),
  ]);

  return (
    <ForBusinessContent
      total={total >= SHOW_COUNTS_FROM ? total : null}
      businesses={businesses.map((b) => ({
        slug: b.slug,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        logoImage: b.logoImage,
        categoryAr: b.category.nameAr,
        categoryEn: b.category.nameEn,
        cityAr: b.city.nameAr,
        cityEn: b.city.nameEn,
      }))}
    />
  );
}
