"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import type { Profile, ServicePreview } from "./SettingsClient";

type Props = {
  profile:  Profile;
  services: ServicePreview[];
};

export default function PublicPagePreview({ profile, services }: Props) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/company/${profile.slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("input");
      el.value = publicUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-5">
      {/* Link section */}
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-[var(--color-text-primary)]">رابط صفحتك العامة</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          شارك هذا الرابط مع عملائك ليتمكنوا من الحجز مباشرة
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 bg-[var(--color-surface-2)] rounded-[var(--radius-md)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] truncate"
            dir="ltr"
          >
            {publicUrl}
          </div>
          <button
            onClick={handleCopy}
            className={`btn gap-2 shrink-0 transition-all ${
              copied
                ? "bg-[var(--color-ok-soft)] text-[var(--color-ok)] border border-[var(--color-ok-line)]"
                : "btn-outline"
            }`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "تم النسخ!" : "نسخ"}
          </button>
          <Link
            href={`/company/${profile.slug}`}
            target="_blank"
            className="btn btn-outline gap-2 shrink-0"
          >
            <ExternalLink size={15} />
            فتح
          </Link>
        </div>
      </div>

      {/* Preview card */}
      <div className="card overflow-hidden p-0">
        <p className="px-5 py-3.5 border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)]">
          معاينة الصفحة
        </p>

        {/* Simulated page card */}
        <div className="p-5">
          <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden max-w-sm mx-auto shadow-sm">
            {/* Cover */}
            <div className="h-24 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-surface-2)] relative">
              {profile.coverImage && (
                <img src={profile.coverImage} alt="" className="w-full h-full object-cover" />
              )}
              {/* Logo */}
              <div className="absolute -bottom-6 start-4 w-14 h-14 rounded-[var(--radius-md)] bg-white shadow-md border border-[var(--color-border)] flex items-center justify-center text-2xl">
                {profile.logoImage
                  ? <img src={profile.logoImage} alt="" className="w-full h-full object-cover rounded-[var(--radius-md)]" />
                  : profile.categoryIcon
                }
              </div>
            </div>

            {/* Info */}
            <div className="pt-9 px-4 pb-4 space-y-1">
              <h3 className="font-bold text-[var(--color-text-primary)]">{profile.nameAr}</h3>
              <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                <span>{profile.categoryIcon}</span>
                {profile.categoryNameAr}
              </p>
              {profile.taglineAr && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                  {profile.taglineAr}
                </p>
              )}
              {profile.address && (
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
                  <MapPin size={11} />
                  {profile.address}
                </p>
              )}
            </div>

            {/* Services preview */}
            {services.length > 0 && (
              <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {services.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">{s.nameAr}</p>
                      <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-0.5 mt-0.5">
                        <Clock size={10} />
                        {s.duration} دقيقة
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-accent)]">
                      {s.price.toLocaleString("ar-EG-u-nu-latn")} {s.currency}
                    </span>
                  </div>
                ))}
                {services.length > 3 && (
                  <p className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] text-center">
                    +{services.length - 3} خدمات أخرى
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card p-5 bg-[var(--color-accent-light)] border-[var(--color-accent)]/20">
        <p className="text-sm font-semibold text-[var(--color-accent)] mb-2">💡 نصائح لصفحة أفضل</p>
        <ul className="space-y-1.5">
          {[
            !profile.about      && "أضف نبذة عن عملك لزيادة الثقة",
            !profile.logoImage  && "أضف شعار لعملك ليبدو أكثر احترافية",
            !profile.coverImage && "أضف صورة غلاف جذابة",
            !profile.phone      && "أضف رقم هاتف للتواصل",
          ]
            .filter(Boolean)
            .map((tip, i) => (
              <li key={i} className="text-xs text-[var(--color-accent)]/80 flex items-start gap-1.5">
                <span>•</span>
                {tip}
              </li>
            ))}
          {profile.about && profile.logoImage && profile.coverImage && profile.phone && (
            <li className="text-xs text-[var(--color-accent)] flex items-center gap-1.5">
              <Check size={13} />
              صفحتك مكتملة ورائعة!
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
