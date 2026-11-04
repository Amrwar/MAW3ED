import type { Metadata } from "next";
import DemoClient from "./_components/DemoClient";
import FunnelView from "@/components/shared/FunnelView";
import { getLang } from "@/lib/lang-server";
import { buildMetadata } from "@/lib/seo/meta";

/**
 * Both languages, a canonical and hreflang like every page — and noindex:
 * the bookings and reviews in it are invented, and a search result must
 * never quote them as if they were a business's. Followed, and not
 * blocked in robots.txt, so crawlers can read the noindex.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const meta =
    lang === "en"
      ? buildMetadata({
          title: "Try the dashboard — sample data",
          description: "A sample Maw3ed business dashboard on invented data. Nothing here is saved.",
          path: "/demo",
          lang,
        })
      : buildMetadata({
          title: "جرّب لوحة التحكم — نسخة تجريبية",
          description: "نسخة تجريبية من لوحة تحكم موعد ببيانات وهمية. مفيش حاجة هنا بتتحفظ.",
          path: "/demo",
        });
  return { ...meta, robots: { index: false, follow: true } };
}

/**
 * A try-before-you-sign-up dashboard, on invented data, entirely in
 * the browser. No session is read and nothing is fetched: see
 * lib/demo/workspace.ts for why it cannot touch a real business.
 */
export default function DemoPage() {
  return (
    <>
      <FunnelView step="DEMO_VIEW" />
      <DemoClient />
    </>
  );
}
