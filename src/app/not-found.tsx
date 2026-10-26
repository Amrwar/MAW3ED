import type { Metadata } from "next";
import ErrorPage from "@/components/shared/ErrorPage";
import { getLang } from "@/lib/lang-server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: lang === "en" ? "404 — Page not found" : "404 — الصفحة غير موجودة",
    robots: { index: false },
  };
}

// Title and text come from ErrorPage, in the page's language.
export default function NotFound() {
  return <ErrorPage code="404" />;
}
