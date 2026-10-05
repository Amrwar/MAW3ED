import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import Logo from "@/components/shared/Logo";
import ResendVerificationButton from "./_components/ResendVerificationButton";

export const metadata: Metadata = { title: "تأكيد البريد الإلكتروني" };

type Status = "success" | "expired" | "invalid" | "error" | "pending";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

/** What the person sees after following the link in their email. */
const COPY: Record<
  Status,
  { title: string; body: string; tone: "ok" | "warn" | "danger" | "neutral" }
> = {
  success: {
    title: "تم تأكيد بريدك",
    body: "صفحة نشاطك اتنشرت وبقت تقدر تستقبل حجوزات. فاضل تأكيد رقم الواتساب عشان تاخد علامة التوثيق.",
    tone: "ok",
  },
  expired: {
    title: "الرابط انتهت صلاحيته",
    body: "الروابط صالحة لمدة 24 ساعة. اطلب رابط جديد من لوحة التحكم.",
    tone: "warn",
  },
  invalid: {
    title: "الرابط غير صالح",
    body: "يمكن يكون الرابط اتستخدم قبل كده أو اتنسخ ناقص. اطلب رابط جديد.",
    tone: "danger",
  },
  error: {
    title: "حصل خطأ",
    body: "مقدرناش نأكد البريد دلوقتي. حاول تاني بعد شوية.",
    tone: "danger",
  },
  pending: {
    title: "أكّد بريدك الإلكتروني",
    body: "بعتنالك رابط تأكيد. افتح بريدك واضغط على الرابط عشان ننشر صفحة نشاطك.",
    tone: "neutral",
  },
};

const ICONS = {
  ok: CheckCircle2,
  warn: Clock,
  danger: XCircle,
  neutral: AlertTriangle,
};

const TONES = {
  ok: "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
  warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  neutral: "bg-[var(--color-surface-3)] text-[var(--color-muted)]",
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const known = ["success", "expired", "invalid", "error"] as const;
  const key: Status = known.includes(status as (typeof known)[number])
    ? (status as Status)
    : "pending";

  const copy = COPY[key];
  const Icon = ICONS[copy.tone];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-ground)]">
      <header className="flex h-20 shrink-0 items-center border-b border-[var(--color-line)] px-6">
        <Logo size="sm" />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-14">
        <div className="w-full max-w-[28rem] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-raised)]">
          <span
            aria-hidden="true"
            className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${TONES[copy.tone]}`}
          >
            <Icon size={28} strokeWidth={1.9} />
          </span>

          <h1 className="m-0 text-[1.625rem] font-light tracking-tight text-[var(--color-ink)]">
            {copy.title}
          </h1>

          <p className="m-0 mx-auto mt-4 max-w-[36ch] text-[0.9375rem] leading-[1.8] text-[var(--color-muted)]">
            {copy.body}
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
            {key === "success" ? (
              <Link href="/dashboard/settings" className="btn btn-primary w-full">
                أكّد رقم الواتساب
              </Link>
            ) : (
              <ResendVerificationButton />
            )}

            <Link href="/dashboard" className="btn btn-outline w-full">
              الذهاب للوحة التحكم
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
