"use client";

import { useState } from "react";
import { CheckCircle, Copy, Check, ExternalLink, LayoutDashboard, MailCheck } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import ResendVerificationButton from "@/app/verify-email/_components/ResendVerificationButton";

interface Props {
  slug:        string;
  nameAr:      string;
  /**
   * Whether the page is live. A business is held back until the owner
   * verifies their email (api/onboarding), and saying "your page is
   * live" before then sends people to a link that 404s.
   */
  published:   boolean;
  onDashboard: () => void;
}

export default function SuccessScreen({ slug, nameAr, published, onDashboard }: Props) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/company/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const el = document.createElement("input");
      el.value = publicUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="card p-8 md:p-12 text-center space-y-8">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-[var(--color-ok-soft)] flex items-center justify-center">
            <CheckCircle size={48} className="text-[var(--color-ok)]" />
          </div>
          <div className="absolute -top-1 -end-1 text-2xl animate-bounce">🎉</div>
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold text-[var(--color-text-primary)]">
          {published ? "صفحتك جاهزة!" : "صفحتك اتعملت — لسه مش منشورة"}
        </h2>
        <p className="text-lg text-[var(--color-text-secondary)]">
          تهانينا، <span className="font-bold text-[var(--color-brand)]">{nameAr}</span>
        </p>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          {published
            ? "صفحتك العامة الآن منشورة وجاهزة لاستقبال الحجوزات. شارك الرابط مع عملائك وابدأ!"
            : "الصفحة ظاهرة ليك بس لحد ما تنشرها. من صفحة تجهيز النشاط هتشوف إيه اللي ناقص، تجرّب حجز تجريبي، وبعدين تنشر. ولازم تأكّد إيميلك قبل النشر — بعتنالك الرابط."}
        </p>
      </div>

      {/* The link only once there is a page behind it. */}
      {published ? (
      <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-4 max-w-sm mx-auto space-y-3">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          رابط صفحتك
        </p>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] break-all" dir="ltr">
          {publicUrl}
        </p>
        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all ${
            copied
              ? "bg-[var(--color-ok-soft)] text-[var(--color-ok)] border border-[var(--color-ok-line)]"
              : "bg-white border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          }`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "تم نسخ الرابط!" : "نسخ الرابط"}
        </button>
      </div>
      ) : (
        <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-4 max-w-sm mx-auto space-y-3 text-start">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <MailCheck size={16} aria-hidden="true" />
            مستني تأكيد الإيميل
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            مش لاقي الرسالة؟ بص في الـ Spam، أو ابعت رابط جديد.
          </p>
          <ResendVerificationButton />
        </div>
      )}

      {/* What's next */}
      <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-4 text-start max-w-sm mx-auto">
        <p className="text-xs font-semibold text-[var(--color-accent)] mb-2">⚡ ما الخطوة التالية؟</p>
        <ul className="space-y-1.5">
          {[
            ...(published
              ? ["شارك رابطك مع عملائك على واتساب", "راجع الحجوزات في لوحة التحكم"]
              : ["أكّد إيميلك", "راجع سياسات الحجز والإلغاء", "اعمل حجز تجريبي من المعاينة", "انشر صفحتك"]),
          ].map((tip) => (
            <li key={tip} className="text-xs text-[var(--color-accent)]/80 flex items-start gap-1.5">
              <span className="shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto w-full">
        {published && (
          <Link
            href={`/company/${slug}`}
            target="_blank"
            className="btn btn-outline flex-1 gap-2"
          >
            <ExternalLink size={16} />
            عرض صفحتي
          </Link>
        )}
        <button
          onClick={onDashboard}
          className="btn btn-primary flex-1 gap-2"
        >
          <LayoutDashboard size={16} />
          {published ? "لوحة التحكم" : "كمّل تجهيز النشاط"}
        </button>
      </div>
    </div>
  );
}
