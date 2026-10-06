import { redirect } from "next/navigation";

/** The reports group opens on revenue. */
export default function ReportsPage() {
  redirect("/dashboard/reports/revenue");
}
