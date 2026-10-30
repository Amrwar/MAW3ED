import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import ImportClient from "./_components/ImportClient";

export const metadata: Metadata = { title: "استيراد البيانات" };

/** Owner only (requireBusinessPage), like the API behind it. */
export default async function ImportPage() {
  await requireBusinessPage();
  return <ImportClient />;
}
