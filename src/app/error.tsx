"use client";

import ErrorPage from "@/components/shared/ErrorPage";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  // Log to console so it's visible in dev; replace with Sentry/etc. in production
  console.error("[GlobalError]", error);

  return (
    <ErrorPage
      code="500"
      title="حدث خطأ في النظام"
      subtitle="نواجه مشكلة مؤقتة غير متوقعة. يرجى إعادة المحاولة أو العودة للصفحة الرئيسية."
      onReset={reset}
    />
  );
}
