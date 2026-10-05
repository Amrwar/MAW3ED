import type { Metadata } from "next";
import ErrorPage from "@/components/shared/ErrorPage";

export const metadata: Metadata = {
  title: "404 — الصفحة غير موجودة",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="الصفحة غير موجودة"
      subtitle="يبدو أن هذا الموعد ضاع في الطريق. الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها إلى رابط آخر."
    />
  );
}
