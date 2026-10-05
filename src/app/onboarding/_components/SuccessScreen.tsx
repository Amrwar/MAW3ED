"use client";

import { useState } from "react";
import { CheckCircle, Copy, Check, ExternalLink, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface Props {
  slug:        string;
  nameAr:      string;
  onDashboard: () => void;
}

export default function SuccessScreen({ slug, nameAr, onDashboard }: Props) {
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
          صفحتك جاهزة!
        </h2>
        <p className="text-lg text-[var(--color-text-secondary)]">
          تهانينا، <span className="font-bold text-[var(--color-brand)]">{nameAr}</span>
        </p>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          صفحتك العامة الآن منشورة وجاهزة لاستقبال الحجوزات. شارك الرابط مع عملائك وابدأ!
        </p>
      </div>

      {/* URL card */}
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

      {/* What's next */}
      <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] p-4 text-start max-w-sm mx-auto">
        <p className="text-xs font-semibold text-[var(--color-accent)] mb-2">⚡ ما الخطوة التالية؟</p>
        <ul className="space-y-1.5">
          {[
            "شارك رابطك مع عملائك على واتساب",
            "راجع الحجوزات في لوحة التحكم",
            "أضف المزيد من الخدمات وقم بتخصيص صفحتك",
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
        <Link
          href={`/company/${slug}`}
          target="_blank"
          className="btn btn-outline flex-1 gap-2"
        >
          <ExternalLink size={16} />
          عرض صفحتي
        </Link>
        <button
          onClick={onDashboard}
          className="btn btn-primary flex-1 gap-2"
        >
          <LayoutDashboard size={16} />
          لوحة التحكم
        </button>
      </div>
    </div>
  );
}
