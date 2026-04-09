"use client";

import { useState } from "react";
import {
  Copy, Check, Gift, Users, Trophy,
  Share2, CalendarCheck, Zap, TrendingUp,
  MessageCircle, Star,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Referral = {
  id:       string;
  nameAr:   string;
  joinedAt: string;
  rewarded: boolean;
};

interface Props {
  referralCode: string;
  referralLink: string;
  referrals:    Referral[];
}

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(iso: string, lang: string) {
  const d      = new Date(iso);
  const months = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Deterministic gradient per name
const GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
];
function grad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

const STEP_ICONS = [
  <Share2      key="share"  size={18} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />,
  <CalendarCheck key="cal" size={18} strokeWidth={1.75} style={{ color: "#059669" }} />,
  <Gift        key="gift"   size={18} strokeWidth={1.75} style={{ color: "#B45309" }} />,
];
const STEP_ICON_BG = ["#EFF6FF", "#F0FDF4", "#FFFBEB"];
const STEP_NUM_COLOR = ["#1D4ED8", "#059669", "#B45309"];

export default function ReferralsClient({ referralCode, referralLink, referrals }: Props) {
  const [copied, setCopied] = useState(false);
  const { t, lang } = useLanguage();
  const rf     = t.dashboard.referrals;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const rewardedCount  = referrals.filter((r) => r.rewarded).length;
  const pendingCount   = referrals.filter((r) => !r.rewarded).length;
  const totalCount     = referrals.length;
  const daysEarned     = rewardedCount * 30;
  const convRate       = totalCount > 0 ? Math.round((rewardedCount / totalCount) * 100) : 0;

  const whatsappText   = encodeURIComponent(`سجّل عملك على موعد الآن واحصل على خصم مميز 🎉\n${referralLink}`);
  const whatsappUrl    = `https://wa.me/?text=${whatsappText}`;

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Hero card ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:   "linear-gradient(135deg, #0F172A 0%, #1D4ED8 60%, #2563EB 100%)",
          boxShadow:    "0 8px 32px rgba(29,78,216,0.3)",
        }}
      >
        {/* Decorative dots */}
        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          {/* Ambient glow blobs */}
          <div
            style={{
              position: "absolute", top: -40, insetInlineEnd: -40,
              width: 200, height: 200, borderRadius: "50%",
              background: "rgba(96,165,250,0.15)", pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute", bottom: -60, insetInlineStart: 60,
              width: 160, height: 160, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", pointerEvents: "none",
            }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Left content */}
            <div className="flex-1">
              {/* Reward pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <Zap size={12} strokeWidth={2} style={{ color: "#FCD34D" }} />
                <span style={{ color: "#FCD34D", fontSize: 11, fontWeight: 700 }}>
                  30 يومًا مجانيًا لكل إحالة ناجحة
                </span>
              </div>

              <h1
                className="font-black text-white leading-tight mb-2"
                style={{ fontSize: 24, letterSpacing: "-0.03em" }}
              >
                اربح من دعوة العملاء
              </h1>
              <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.6, maxWidth: 320 }}>
                {rf.subtitle}
              </p>

              {/* CTA row */}
              <div className="flex flex-wrap gap-2.5 mt-5">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150"
                  style={{
                    background: "#FFFFFF",
                    color:      "#1D4ED8",
                    boxShadow:  "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
                  }}
                >
                  {copied
                    ? <><Check size={15} strokeWidth={2.5} /> تم النسخ</>
                    : <><Copy size={15} strokeWidth={2} />   نسخ الرابط</>
                  }
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color:      "#FFFFFF",
                    border:     "1px solid rgba(255,255,255,0.2)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.12)";
                  }}
                >
                  <MessageCircle size={15} strokeWidth={2} />
                  واتساب
                </a>
              </div>
            </div>

            {/* Right: earnings counter */}
            {daysEarned > 0 && (
              <div
                className="shrink-0 rounded-2xl px-6 py-5 text-center"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <Star size={20} strokeWidth={1.75} style={{ color: "#FCD34D", margin: "0 auto 8px" }} />
                <p
                  className="font-black text-white leading-none"
                  style={{ fontSize: 36, letterSpacing: "-0.04em" }}
                >
                  {daysEarned}
                </p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
                  يومًا مكافأة مكتسبة
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div
          className="flex items-center gap-2.5 px-6 py-4"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <Gift size={14} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
          <h2 className="text-sm font-bold text-[#0F172A]">{rf.howItWorksTitle}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
          style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}
        >
          {rf.steps.map(({ step, title, desc }, idx) => (
            <div key={step} className="px-6 py-5 flex flex-col items-start gap-3">
              {/* Icon + connector */}
              <div className="flex items-center gap-3 w-full">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: STEP_ICON_BG[idx] }}
                >
                  {STEP_ICONS[idx]}
                </div>
                <div
                  className="h-px flex-1 hidden sm:block"
                  style={{
                    background: idx < 2 ? `linear-gradient(to left, transparent, ${STEP_NUM_COLOR[idx]}33)` : "transparent",
                  }}
                />
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${STEP_NUM_COLOR[idx]}15`, color: STEP_NUM_COLOR[idx] }}
                >
                  {idx + 1}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">{title}</p>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Referral link card ────────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-6"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#0F172A]">{rf.yourLink}</h2>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full"
            style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
          >
            <span style={{ letterSpacing: "0.1em", fontFamily: "monospace" }}>{referralCode}</span>
          </span>
        </div>

        {/* Link input row */}
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 mb-3"
          style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0" }}
        >
          <span
            className="flex-1 text-sm text-[#475569] truncate"
            style={{ fontFamily: "monospace", fontSize: 12 }}
            dir="ltr"
          >
            {referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 shrink-0"
            style={
              copied
                ? { background: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0" }
                : { background: "#0F172A", color: "#FFFFFF", border: "none", boxShadow: "0 2px 8px rgba(15,23,42,0.2)" }
            }
            onMouseEnter={(e) => {
              if (!copied) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B";
            }}
            onMouseLeave={(e) => {
              if (!copied) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A";
            }}
          >
            {copied ? <><Check size={12} strokeWidth={2.5} /> {rf.copied}</> : <><Copy size={12} /> {rf.copy}</>}
          </button>
        </div>

        {/* Share buttons row */}
        <div className="flex gap-2 flex-wrap">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150"
            style={{
              background: "#DCFCE7",
              color:      "#15803D",
              border:     "1px solid #BBF7D0",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#BBF7D0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#DCFCE7";
            }}
          >
            <MessageCircle size={13} strokeWidth={2} />
            مشاركة عبر واتساب
          </a>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150"
            style={{
              background:  "#F8FAFC",
              color:       "#475569",
              border:      "1px solid #E2E8F0",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            }}
          >
            <Copy size={13} />
            نسخ الرابط
          </button>
        </div>
      </div>

      {/* ── Stats cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={16} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          iconBg="#EFF6FF"
          value={totalCount.toLocaleString(locale)}
          label={rf.statsTotal}
          sub="إجمالي"
        />
        <StatCard
          icon={<Trophy size={16} strokeWidth={1.75} style={{ color: "#15803D" }} />}
          iconBg="#F0FDF4"
          value={rewardedCount.toLocaleString(locale)}
          label={rf.statsSuccess}
          sub="حصلوا على اشتراك"
          accent="#15803D"
        />
        <StatCard
          icon={<TrendingUp size={16} strokeWidth={1.75} style={{ color: "#B45309" }} />}
          iconBg="#FFFBEB"
          value={pendingCount.toLocaleString(locale)}
          label="في الانتظار"
          sub="لم يشتركوا بعد"
        />
        <StatCard
          icon={<Gift size={16} strokeWidth={1.75} style={{ color: "#7C3AED" }} />}
          iconBg="#F5F3FF"
          value={`${daysEarned.toLocaleString(locale)}`}
          label={rf.statsDays}
          sub={`معدل التحويل ${convRate}%`}
        />
      </div>

      {/* ── Referrals list ────────────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        {/* List header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-[#0F172A]">{rf.listTitle}</h3>
            {totalCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#F1F5F9", color: "#64748B" }}
              >
                {totalCount}
              </span>
            )}
            {rewardedCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#DCFCE7", color: "#15803D" }}
              >
                {rewardedCount} ناجحة
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <span className="text-xs text-[#94A3B8]">
              {totalCount} {rf.businesses}
            </span>
          )}
        </div>

        {/* Empty state */}
        {totalCount === 0 ? (
          <div className="py-16 px-6 text-center">
            <div
              className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                border:     "1px solid #BFDBFE",
              }}
            >
              <Users size={30} strokeWidth={1.5} style={{ color: "#3B82F6" }} />
            </div>
            <h4
              className="font-black text-[#0F172A] mb-2"
              style={{ fontSize: 16, letterSpacing: "-0.01em" }}
            >
              {rf.emptyTitle}
            </h4>
            <p className="text-sm text-[#94A3B8] mb-6 max-w-xs mx-auto leading-relaxed">
              {rf.emptySub}
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                  boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
                }}
              >
                <MessageCircle size={14} />
                مشاركة عبر واتساب
              </a>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background:  "#F8FAFC",
                  border:      "1px solid #E2E8F0",
                  color:       "#475569",
                }}
              >
                <Copy size={14} />
                نسخ الرابط
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 text-xs font-semibold"
              style={{ background: "#FAFBFD", borderBottom: "1px solid #F1F5F9", color: "#94A3B8", letterSpacing: "0.02em" }}
            >
              <span>العمل</span>
              <span>تاريخ الانضمام</span>
              <span>الحالة</span>
            </div>

            {/* Rows */}
            {referrals.map((ref, idx) => (
              <div
                key={ref.id}
                className="flex items-center gap-4 px-6 py-4 transition-colors"
                style={{ borderTop: idx > 0 ? "1px solid #F8FAFC" : "none" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "#FAFBFD";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                  style={{ background: grad(ref.nameAr) }}
                >
                  {ref.nameAr[0]}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate leading-snug">{ref.nameAr}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    {rf.joined} {formatDate(ref.joinedAt, lang)}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
                  style={
                    ref.rewarded
                      ? { background: "#DCFCE7", color: "#15803D" }
                      : { background: "#FEF3C7", color: "#92400E" }
                  }
                >
                  {ref.rewarded ? rf.rewarded : rf.notSubscribed}
                </span>
              </div>
            ))}

            {/* List footer */}
            <div
              className="px-6 py-3 text-center"
              style={{ borderTop: "1px solid #F1F5F9" }}
            >
              <p className="text-xs text-[#94A3B8]">
                {rewardedCount > 0
                  ? `🎉 لقد ربحت ${daysEarned} يومًا مجانيًا حتى الآن`
                  : "شارك رابطك لتبدأ في كسب الأيام المجانية"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom sharing nudge (only when list exists) ─────── */}
      {totalCount > 0 && (
        <div
          className="rounded-2xl border px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background:  "rgba(29,78,216,0.03)",
            borderColor: "rgba(29,78,216,0.15)",
          }}
        >
          <div>
            <p className="text-sm font-bold text-[#1D4ED8]">شارك مع المزيد</p>
            <p className="text-xs text-[#475569] mt-0.5">
              كل إحالة ناجحة = 30 يومًا إضافيًا مجانًا
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150"
              style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#DBEAFE"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF"; }}
            >
              <Copy size={12} />
              نسخ
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150"
              style={{ background: "#0F172A", color: "#FFFFFF" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#1E293B"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0F172A"; }}
            >
              <MessageCircle size={12} />
              واتساب
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, iconBg, value, label, sub, accent,
}: {
  icon:    React.ReactNode;
  iconBg:  string;
  value:   string;
  label:   string;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-black leading-none"
        style={{
          fontSize:        24,
          letterSpacing:   "-0.02em",
          color:           accent ?? "#0F172A",
        }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[#475569] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  );
}
