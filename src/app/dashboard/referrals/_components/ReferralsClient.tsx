"use client";

import { useState } from "react";
import { Copy, Check, Gift, Users, Trophy, Link2 } from "lucide-react";

type Referral = {
  id:       string;
  nameAr:   string;
  joinedAt: string; // ISO string
  rewarded: boolean;
};

interface Props {
  referralCode: string;
  referralLink: string;
  referrals:    Referral[];
}

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ReferralsClient({ referralCode, referralLink, referrals }: Props) {
  const [copied, setCopied] = useState(false);

  const rewardedCount = referrals.filter((r) => r.rewarded).length;
  const totalCount    = referrals.length;
  const daysEarned    = rewardedCount * 30;

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--color-text-primary)]">ادعُ واكسب</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          ادعُ أصحاب الأعمال وكسب شهرًا مجانيًا لكل عميل يشترك
        </p>
      </div>

      {/* How it works */}
      <div className="card p-6">
        <h2 className="font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Gift size={16} className="text-[var(--color-accent)]" />
          كيف يعمل؟
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "١", title: "شارك رابطك",       desc: "أرسل رابط الإحالة لأي صاحب عمل" },
            { step: "٢", title: "يسجّل ويكمل إعداده", desc: "يفتح حساب ويجهّز عمله على موعد"  },
            { step: "٣", title: "تكسب شهرًا مجانيًا", desc: "بمجرد اشتراكه تحصل على 30 يومًا إضافية" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-sm font-black text-[var(--color-accent)] shrink-0">
                {step}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link */}
      <div className="card p-6">
        <h2 className="font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Link2 size={16} className="text-[var(--color-accent)]" />
          رابط الإحالة الخاص بك
        </h2>
        <div className="flex items-center gap-2 bg-[var(--color-surface-2)] rounded-xl px-4 py-3">
          <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate" dir="ltr">
            {referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "تم النسخ" : "نسخ"}
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          كود الإحالة: <span className="font-mono font-bold tracking-widest text-[var(--color-text-primary)]">{referralCode}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
            <Users size={18} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-[var(--color-text-primary)]">
            {totalCount.toLocaleString("ar-EG")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">إجمالي الإحالات</p>
        </div>

        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-2">
            <Trophy size={18} className="text-green-500" />
          </div>
          <p className="text-2xl font-black text-[var(--color-text-primary)]">
            {rewardedCount.toLocaleString("ar-EG")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">إحالات ناجحة</p>
        </div>

        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-2">
            <Gift size={18} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-[var(--color-text-primary)]">
            {daysEarned.toLocaleString("ar-EG")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">يومًا مكافأة</p>
        </div>
      </div>

      {/* Referrals list */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-[var(--color-text-primary)]">قائمة الإحالات</h3>
          <span className="text-xs text-[var(--color-text-muted)]">{totalCount} عمل</span>
        </div>

        {totalCount === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">لا توجد إحالات بعد</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              شارك رابطك مع أصحاب الأعمال وستظهر إحالاتهم هنا
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-sm font-bold text-[var(--color-accent)]">
                    {ref.nameAr[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{ref.nameAr}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      انضم {formatDate(ref.joinedAt)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    ref.rewarded
                      ? "bg-green-50 text-green-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {ref.rewarded ? "مكافأة ✓" : "لم يشترك بعد"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
