import ResendVerificationButton from "@/app/verify-email/_components/ResendVerificationButton";

/**
 * The owner has not confirmed their email, so their page is not public
 * yet. Shown above every dashboard page until they do.
 */
export default function VerifyEmailBanner({ email, lang }: { email: string; lang: "ar" | "en" }) {
  const ar = lang === "ar";
  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          {ar ? "أكّد بريدك عشان صفحتك تتنشر" : "Confirm your email to publish your page"}
        </p>
        <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-muted)]">
          {ar ? (
            <>
              بعتنا رابط تأكيد على <span dir="ltr">{email}</span>. صفحة نشاطك مش ظاهرة للعملاء لحد ما تأكده.
            </>
          ) : (
            <>
              We sent a confirmation link to <span dir="ltr">{email}</span>. Customers can&apos;t see your page until you confirm it.
            </>
          )}
        </p>
      </div>
      <div className="sm:w-56">
        <ResendVerificationButton />
      </div>
    </div>
  );
}
