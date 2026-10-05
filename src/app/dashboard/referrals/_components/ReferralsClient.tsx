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
  "linear-gradient(135deg,var(--color-jade),var(--color-jade))",
  "linear-gradient(135deg,var(--color-jade),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-ok),var(--color-jade))",
  "linear-gradient(135deg,var(--color-warn),var(--color-star))",
  "linear-gradient(135deg,var(--color-info),var(--color-info))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
];
function grad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

const STEP_ICONS = [
  <Share2      key="share"  size={18} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />,
  <CalendarCheck key="cal" size={18} strokeWidth={1.75} style={{ color: "var(--color-ok)" }} />,
  <Gift        key="gift"   size={18} strokeWidth={1.75} style={{ color: "var(--color-warn)" }} />,
];
const STEP_ICON_BG = ["var(--color-jade-tint)", "var(--color-ok-soft)", "var(--color-warn-soft)"];
const STEP_NUM_COLOR = ["var(--color-jade)", "var(--color-ok)", "var(--color-warn)"];

export default function ReferralsClient({ referralCode, referralLink, referrals }: Props) {
  const [copied, setCopied] = useState(false);
  const { t, lang } = useLanguage();
  const rf     = t.dashboard.referrals;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

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
    <div className="space-y-5">

      {/* ── Hero card ──────────────────────────────────────────── */}
      <div
        className="rounded-[var(--radius-lg)] overflow-hidden"
        style={{
          background:   "linear-gradient(135deg, var(--color-ink) 0%, var(--color-jade) 60%, var(--color-jade-hover) 100%)",
          boxShadow:    "0 8px 32px rgba(10,95,71,0.3)",
        }}
      >
        {/* Decorative dots */}
        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          {/* Ambient glow blobs */}
          <div
            style={{
              position: "absolute", top: -40, insetInlineEnd: -40,
              width: 200, height: 200, borderRadius: "50%",
              background: "rgba(14,127,94,0.15)", pointerEvents: "none",
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
                <Zap size={12} strokeWidth={2} style={{ color: "var(--color-star)" }} />
                <span style={{ color: "var(--color-star)", fontSize: 11, fontWeight: 700 }}>
                  30 يومًا مجانيًا لكل إحالة ناجحة
                </span>
              </div>

              <h1
                className="font-extrabold text-white leading-tight mb-2 text-[1.5rem]"
                style={{ letterSpacing: "-0.03em" }}
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] font-bold text-sm transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                  style={{
                    background: "var(--color-surface)",
                    color:      "var(--color-jade)",
                    boxShadow:  "0 4px 12px rgba(0,0,0,0.15)",
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] font-bold text-sm transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color:      "var(--color-surface)",
                    border:     "1px solid rgba(255,255,255,0.2)",
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
                className="shrink-0 rounded-[var(--radius-lg)] px-6 py-5 text-center"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <Star size={20} strokeWidth={1.75} style={{ color: "var(--color-star)", margin: "0 auto 8px" }} />
                <p
                  className="font-extrabold text-white leading-none text-[2.25rem]"
                  style={{ letterSpacing: "-0.04em" }}
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
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
      >
        <div
          className="flex items-center gap-2.5 px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-surface-3)" }}
        >
          <Gift size={14} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />
          <h2 className="text-sm font-bold text-[var(--color-ink)]">{rf.howItWorksTitle}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
          style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}
        >
          {rf.steps.map(({ step, title, desc }, idx) => (
            <div key={step} className="px-6 py-5 flex flex-col items-start gap-3">
              {/* Icon + connector */}
              <div className="flex items-center gap-3 w-full">
                <div
                  className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
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
                  className="text-xs font-extrabold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${STEP_NUM_COLOR[idx]}15`, color: STEP_NUM_COLOR[idx] }}
                >
                  {idx + 1}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-ink)]">{title}</p>
                <p className="text-xs text-[var(--color-subtle)] mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Referral link card ────────────────────────────────── */}
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--color-ink)]">{rf.yourLink}</h2>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full"
            style={{ background: "var(--color-jade-tint)", color: "var(--color-jade)", border: "1px solid var(--color-jade-line)" }}
          >
            <span style={{ letterSpacing: "0.1em", fontFamily: "monospace" }}>{referralCode}</span>
          </span>
        </div>

        {/* Link input row */}
        <div
          className="flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 mb-3"
          style={{ background: "var(--color-surface-2)", border: "1.5px solid var(--color-line)" }}
        >
          <span
            className="flex-1 text-sm text-[var(--color-muted)] truncate text-xs"
            style={{ fontFamily: "monospace" }}
            dir="ltr"
          >
            {referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 shrink-0 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={
              copied
                ? { background: "var(--color-ok-soft)", color: "var(--color-ok)", border: "1px solid var(--color-ok-line)" }
                : { background: "var(--color-ink)", color: "var(--color-surface)", border: "none", boxShadow: "0 2px 8px rgba(17,32,28,0.2)" }
            }
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={{
              background: "var(--color-ok-soft)",
              color:      "var(--color-ok)",
              border:     "1px solid var(--color-ok-line)",
            }}
          >
            <MessageCircle size={13} strokeWidth={2} />
            مشاركة عبر واتساب
          </a>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={{
              background:  "var(--color-surface-2)",
              color:       "var(--color-muted)",
              border:      "1px solid var(--color-line)",
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
          icon={<Users size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={totalCount.toLocaleString(locale)}
          label={rf.statsTotal}
          sub="إجمالي"
        />
        <StatCard
          icon={<Trophy size={16} strokeWidth={1.75} style={{ color: "var(--color-ok)" }} />}
          iconBg="var(--color-ok-soft)"
          value={rewardedCount.toLocaleString(locale)}
          label={rf.statsSuccess}
          sub="حصلوا على اشتراك"
          accent="var(--color-ok)"
        />
        <StatCard
          icon={<TrendingUp size={16} strokeWidth={1.75} style={{ color: "var(--color-warn)" }} />}
          iconBg="var(--color-warn-soft)"
          value={pendingCount.toLocaleString(locale)}
          label="في الانتظار"
          sub="لم يشتركوا بعد"
        />
        <StatCard
          icon={<Gift size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={`${daysEarned.toLocaleString(locale)}`}
          label={rf.statsDays}
          sub={`معدل التحويل ${convRate}%`}
        />
      </div>

      {/* ── Referrals list ────────────────────────────────────── */}
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
      >
        {/* List header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-surface-3)" }}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-[var(--color-ink)]">{rf.listTitle}</h3>
            {totalCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
              >
                {totalCount}
              </span>
            )}
            {rewardedCount > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-ok-soft)", color: "var(--color-ok)" }}
              >
                {rewardedCount} ناجحة
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <span className="text-xs text-[var(--color-subtle)]">
              {totalCount} {rf.businesses}
            </span>
          )}
        </div>

        {/* Empty state */}
        {totalCount === 0 ? (
          <div className="py-16 px-6 text-center">
            <div
              className="w-20 h-20 rounded-[var(--radius-xl)] mx-auto mb-5 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--color-jade-tint) 0%, var(--color-jade-soft) 100%)",
                border:     "1px solid var(--color-jade-line)",
              }}
            >
              <Users size={30} strokeWidth={1.5} style={{ color: "var(--color-jade)" }} />
            </div>
            <h4
              className="font-extrabold text-[var(--color-ink)] mb-2 text-base"
              style={{ letterSpacing: "-0.01em" }}
            >
              {rf.emptyTitle}
            </h4>
            <p className="text-sm text-[var(--color-subtle)] mb-6 max-w-xs mx-auto leading-relaxed">
              {rf.emptySub}
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                  boxShadow:  "0 4px 14px rgba(14,127,94,0.28)",
                }}
              >
                <MessageCircle size={14} />
                مشاركة عبر واتساب
              </a>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-bold"
                style={{
                  background:  "var(--color-surface-2)",
                  border:      "1px solid var(--color-line)",
                  color:       "var(--color-muted)",
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
              style={{ background: "var(--color-ground)", borderBottom: "1px solid var(--color-surface-3)", color: "var(--color-subtle)", letterSpacing: "0.02em" }}
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
                style={{ borderTop: idx > 0 ? "1px solid var(--color-surface-2)" : "none" }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white shrink-0"
                  style={{ background: grad(ref.nameAr) }}
                >
                  {ref.nameAr[0]}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--color-ink)] truncate leading-snug">{ref.nameAr}</p>
                  <p className="text-xs text-[var(--color-subtle)] mt-0.5">
                    {rf.joined} {formatDate(ref.joinedAt, lang)}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
                  style={
                    ref.rewarded
                      ? { background: "var(--color-ok-soft)", color: "var(--color-ok)" }
                      : { background: "var(--color-warn-soft)", color: "var(--color-warn)" }
                  }
                >
                  {ref.rewarded ? rf.rewarded : rf.notSubscribed}
                </span>
              </div>
            ))}

            {/* List footer */}
            <div
              className="px-6 py-3 text-center"
              style={{ borderTop: "1px solid var(--color-surface-3)" }}
            >
              <p className="text-xs text-[var(--color-subtle)]">
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
          className="rounded-[var(--radius-lg)] border px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background:  "rgba(10,95,71,0.03)",
            borderColor: "rgba(10,95,71,0.15)",
          }}
        >
          <div>
            <p className="text-sm font-bold text-[var(--color-jade)]">شارك مع المزيد</p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              كل إحالة ناجحة = 30 يومًا إضافيًا مجانًا
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
              style={{ background: "var(--color-jade-tint)", color: "var(--color-jade)", border: "1px solid var(--color-jade-line)" }}
            >
              <Copy size={12} />
              نسخ
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
              style={{ background: "var(--color-ink)", color: "var(--color-surface)" }}
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
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
    >
      <div
        className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-extrabold leading-none text-[1.5rem]"
        style={{
          letterSpacing:   "-0.02em",
          color:           accent ?? "var(--color-ink)" }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[var(--color-subtle)] mt-0.5">{sub}</p>}
    </div>
  );
}
