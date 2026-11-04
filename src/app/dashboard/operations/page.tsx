import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import OperationsClient from "./_components/OperationsClient";

export const metadata: Metadata = { title: "التشغيل اليومي" };

/**
 * The business's operating rules (no-shows, waitlist, companions,
 * automatic messages) and the daily operations report. Owner only: the
 * report carries revenue and staff commission.
 */
export default async function OperationsPage() {
  await requireBusinessPage();
  return <OperationsClient />;
}
