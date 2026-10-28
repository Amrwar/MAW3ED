"use client";

import Link from "next/link";
import Image from "next/image";
import { Home, Search, Calendar, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Arabic and English, by the page's language. This page was Arabic only,
// so an English visitor who mistyped a link landed somewhere else entirely.
const TEXT = {
  ar: {
    notFoundTitle:    "الصفحة غير موجودة",
    notFoundBody:     "يبدو أن هذا الموعد ضاع في الطريق. الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها.",
    errorBody:        "حدث خطأ غير متوقع في النظام. يرجى إعادة المحاولة أو العودة للصفحة الرئيسية.",
    homeAria:         "موعد — الصفحة الرئيسية",
    backHome:         "العودة للرئيسية",
    code:             "رمز الخطأ",
    home:             "الصفحة الرئيسية",
    browse:           "استكشف الأعمال",
    retry:            "↺ إعادة المحاولة",
    more:             "قد يهمك أيضًا",
    categories:       "التصنيفات",
    cities:           "المدن",
    forBusiness:      "لأصحاب الأعمال",
    contact:          "تواصل معنا",
    rights:           "جميع الحقوق محفوظة",
  },
  en: {
    notFoundTitle:    "Page not found",
    notFoundBody:     "This appointment seems to have got lost on the way. The page you are looking for does not exist or has moved.",
    errorBody:        "Something unexpected went wrong. Try again, or go back to the home page.",
    homeAria:         "Maw3ed — home",
    backHome:         "Back to home",
    code:             "Error code",
    home:             "Home",
    browse:           "Browse businesses",
    retry:            "↺ Try again",
    more:             "You might also like",
    categories:       "Categories",
    cities:           "Cities",
    forBusiness:      "For business owners",
    contact:          "Contact us",
    rights:           "All rights reserved",
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  code?:     string;
  title?:    string;
  subtitle?: string;
  onReset?:  () => void;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ErrorPage({
  code     = "404",
  title,
  subtitle,
  onReset,
}: Props) {
  const { lang } = useLanguage();
  const tx = TEXT[lang];
  const dir = lang === "en" ? "ltr" : "rtl";
  const LinkArrow = lang === "en" ? ArrowRight : ArrowLeft;
  const defaultSubtitle = code === "404" ? tx.notFoundBody : tx.errorBody;

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{ background: "var(--color-surface-2)", fontFamily: "var(--font-cairo, Cairo, sans-serif)" }}
    >
      {/* ── Keyframe animations ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes maw3ed-float-main {
          0%, 100% { transform: rotate(-3deg) translateY(0px);  }
          50%       { transform: rotate(-3deg) translateY(-10px); }
        }
        @keyframes maw3ed-float-back {
          0%, 100% { transform: rotate(5deg) translateY(0px); }
          50%       { transform: rotate(5deg) translateY(-6px); }
        }
        @keyframes maw3ed-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(14,127,94,0.25), 0 4px 16px rgba(14,127,94,0.15); }
          50%       { box-shadow: 0 0 0 8px rgba(14,127,94,0),   0 4px 24px rgba(14,127,94,0.30); }
        }
        @keyframes maw3ed-chip-float {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-5px); }
        }
        .maw3ed-card-main  { animation: maw3ed-float-main  4s   ease-in-out infinite; }
        .maw3ed-card-back  { animation: maw3ed-float-back  5.5s ease-in-out infinite; animation-delay: -1.8s; }
        .maw3ed-badge      { animation: maw3ed-badge-pulse  3s   ease-in-out infinite; }
        .maw3ed-chip       { animation: maw3ed-chip-float   6s   ease-in-out infinite; animation-delay: -3s; }
      `}</style>

      {/* ── Ambient background glows ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div style={{
          position: "absolute", top: "0%", left: "-5%",
          width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,127,94,0.065) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,127,94,0.055) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "40%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,127,94,0.035) 0%, transparent 70%)",
        }} />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          borderBottom:    "1px solid var(--color-line)",
          background:      "rgba(244,245,241,0.97)",
          backdropFilter:  "blur(20px)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" aria-label={tx.homeAria}>
            <Image src="/logo.png" alt="" width={110} height={46} className="object-contain" priority />
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold transition-colors"
            style={{ color: "var(--color-muted)" }}
            dir={dir}
          >
            {tx.backHome}
          </Link>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main id="main" className="max-w-5xl mx-auto px-6 py-14 lg:py-20" dir={dir}>
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-8">

          {/* ── Column 1: Text content ── */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-start order-2 lg:order-1 max-w-lg w-full">

            {/* Code badge */}
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 text-xs font-bold"
              style={{
                background: "var(--color-jade-soft)",
                color:       "var(--color-jade)",
                border:      "1px solid rgba(14,127,94,0.22)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-jade)] animate-pulse" />
              {tx.code} {code}
            </div>

            {/* Headline */}
            <h1
              className="font-extrabold leading-tight mb-4"
              style={{
                fontSize:      "clamp(30px, 5vw, 46px)",
                color:         "var(--color-ink)",
                letterSpacing: "-0.03em",
                lineHeight:    1.18,
              }}
            >
              {title ?? tx.notFoundTitle}
            </h1>

            {/* Subtitle */}
            <p
              className="text-base leading-relaxed mb-8"
              style={{ color: "var(--color-muted)", lineHeight: 1.75, maxWidth: 400 }}
            >
              {subtitle ?? defaultSubtitle}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[var(--radius-lg)] text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                  boxShadow:  "0 4px 16px rgba(14,127,94,0.35), 0 1px 4px rgba(17,32,28,0.12)",
                }}
              >
                <Home size={15} />
                {tx.home}
              </Link>

              <Link
                href="/businesses"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[var(--radius-lg)] text-sm font-bold transition-all duration-200"
                style={{
                  background: "var(--color-surface)",
                  border:     "1.5px solid var(--color-line)",
                  color:      "var(--color-ink)",
                  boxShadow:  "0 2px 8px rgba(17,32,28,0.05)",
                }}
              >
                <Search size={15} />
                {tx.browse}
              </Link>

              {onReset && (
                <button
                  onClick={onReset}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[var(--radius-lg)] text-sm font-bold transition-all duration-200"
                  style={{
                    background: "var(--color-surface)",
                    border:     "1.5px solid var(--color-line)",
                    color:      "var(--color-muted)",
                  }}
                >
                  {tx.retry}
                </button>
              )}
            </div>

            {/* Quick links card */}
            <div
              className="w-full rounded-[var(--radius-lg)] p-5"
              style={{
                background: "var(--color-surface)",
                border:     "1.5px solid var(--color-line)",
                boxShadow:  "0 2px 12px rgba(17,32,28,0.04)",
              }}
            >
              <p
                className="text-xs font-extrabold mb-4 uppercase tracking-widest"
                style={{ color: "var(--color-subtle)" }}
              >
                {tx.more}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  { href: "/",             label: tx.home        },
                  { href: "/businesses",   label: tx.browse      },
                  { href: "/categories",   label: tx.categories  },
                  { href: "/cities",       label: tx.cities      },
                  { href: "/for-business", label: tx.forBusiness },
                  { href: "/contact",      label: tx.contact     },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center gap-2 py-2.5 text-sm font-semibold transition-colors"
                    style={{ color: "var(--color-muted)" }}
                  >
                    <LinkArrow
                      size={12}
                      style={{ color: "var(--color-line-2)", transition: "color 0.15s, transform 0.15s" }}
                      className="group-hover:text-[var(--color-jade)]"
                    />
                    <span className="group-hover:text-[var(--color-jade)] transition-colors">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Column 2: Illustration ── */}
          <div className="flex-shrink-0 order-1 lg:order-2 w-full lg:w-[430px]">
            <ErrorIllustration code={code} />
          </div>

        </div>
      </main>

      {/* ── Footer strip ─────────────────────────────────────────────────────── */}
      <footer
        className="py-6 text-xs text-center"
        style={{ color: "var(--color-subtle)", borderTop: "1px solid var(--color-surface-3)" }}
      >
        © {new Date().getFullYear()} موعد · Maw3ed — {tx.rights}
      </footer>
    </div>
  );
}

// ─── Illustration ─────────────────────────────────────────────────────────────

function ErrorIllustration({ code }: { code: string }) {
  return (
    <div style={{ position: "relative", height: 420, width: "100%" }}>

      {/* Central soft glow */}
      <div
        aria-hidden
        style={{
          position:     "absolute",
          top:          "50%",
          left:         "50%",
          transform:    "translate(-50%, -50%)",
          width:        340,
          height:       340,
          borderRadius: "50%",
          background:   "radial-gradient(circle, rgba(14,127,94,0.11) 0%, rgba(14,127,94,0.06) 45%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── 404 watermark ── */}
      <div
        aria-hidden
        className="select-none"
        style={{
          position:          "absolute",
          top:               "50%",
          left:              "50%",
          transform:         "translate(-50%, -50%)",
          fontSize:          "clamp(130px, 20vw, 185px)",
          fontWeight:        900,
          letterSpacing:     "-0.06em",
          color:             "transparent",
          WebkitTextStroke:  "2px var(--color-line)",
          lineHeight:        1,
          whiteSpace:        "nowrap",
          zIndex:            1,
          userSelect:        "none",
        }}
      >
        {code}
      </div>

      {/* ── Ghost card (behind) ── */}
      <div
        style={{
          position: "absolute",
          top:      "50%",
          left:     "calc(50% + 28px)",
          zIndex:   2,
          marginTop: "-55px",
        }}
      >
        <div
          className="maw3ed-card-back"
          style={{
            width:        210,
            borderRadius: 16,
            background:   "linear-gradient(145deg, var(--color-surface-2), var(--color-surface-3))",
            border:       "1.5px solid var(--color-line)",
            boxShadow:    "0 8px 28px rgba(17,32,28,0.07)",
            padding:      "13px 15px",
            opacity:      0.55,
            display:      "flex",
            flexDirection:"column",
            gap:          9,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: "var(--color-line)" }} />
            <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--color-line)" }} />
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "var(--color-surface-2)" }} />
          <div style={{ width: "78%", height: 7, borderRadius: 4, background: "var(--color-surface-2)" }} />
          <div style={{ width: "60%", height: 7, borderRadius: 4, background: "var(--color-surface-2)" }} />
          <div style={{ borderTop: "1px dashed var(--color-line)", marginTop: 2 }} />
          <div
            style={{
              height:       24,
              borderRadius: 8,
              background:   "linear-gradient(90deg, var(--color-danger-soft), var(--color-danger-soft))",
              display:      "flex",
              alignItems:   "center",
              paddingInline: 8,
              gap:          6,
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-danger-line)" }} />
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--color-danger-line)" }} />
          </div>
        </div>
      </div>

      {/* ── Main booking card ── */}
      <div
        style={{
          position:  "absolute",
          top:       "50%",
          left:      "50%",
          marginTop: "-120px",
          marginLeft:"-125px",
          zIndex:    4,
        }}
      >
        <div
          className="maw3ed-card-main"
          style={{
            width:        250,
            borderRadius: 20,
            background:   "var(--color-surface)",
            border:       "1.5px solid var(--color-line)",
            boxShadow:    "0 24px 64px rgba(17,32,28,0.14), 0 6px 20px rgba(17,32,28,0.07)",
            overflow:     "hidden",
          }}
        >
          {/* Card header — blue gradient */}
          <div
            style={{
              padding:    "13px 15px",
              background: "linear-gradient(135deg, var(--color-jade-hover) 0%, var(--color-jade) 100%)",
              display:    "flex",
              alignItems: "center",
              gap:        10,
            }}
          >
            <div
              style={{
                width:          32,
                height:         32,
                borderRadius:   9,
                background:     "rgba(255,255,255,0.18)",
                border:         "1px solid rgba(255,255,255,0.22)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                overflow:       "hidden",
                flexShrink:     0,
              }}
            >
              <Image
                src="/icon-nobg.png"
                alt=""
                width={22}
                height={22}
                style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <div>
              <p style={{ color: "var(--color-surface)", fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
                احجز ميعادك
              </p>
              <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 10, marginTop: 2 }}>
                موعد · Maw3ed
              </p>
            </div>
            <div
              style={{
                marginInlineStart: "auto",
                display:           "flex",
                gap:               4,
                alignItems:        "center",
              }}
            >
              {[0.3, 0.55, 0.85].map((op, i) => (
                <div
                  key={i}
                  style={{
                    width:        5,
                    height:       5,
                    borderRadius: "50%",
                    background:   `rgba(255,255,255,${op})`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Card body */}
          <div
            style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}
            dir="rtl"
          >
            {/* Service row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width:          30,
                  height:         30,
                  borderRadius:   9,
                  background:     "var(--color-jade-soft)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  flexShrink:     0,
                }}
              >
                <Calendar size={13} color="var(--color-jade)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 5, fontWeight: 600 }}>
                  الخدمة المطلوبة
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  {[42, 30, 22].map((w, i) => (
                    <div
                      key={i}
                      style={{ width: w, height: 7, borderRadius: 3, background: "var(--color-surface-3)" }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Time row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width:          30,
                  height:         30,
                  borderRadius:   9,
                  background:     "var(--color-surface-2)",
                  border:         "1px solid var(--color-line)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  flexShrink:     0,
                }}
              >
                <Clock size={13} color="var(--color-subtle)" />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--color-subtle)", marginBottom: 4, fontWeight: 600 }}>
                  التاريخ والوقت
                </p>
                <p
                  style={{
                    fontSize:           11,
                    fontWeight:         800,
                    // --color-line-2 is a border tone (1.38:1 on white);
                    // text, even placeholder text, needs the subtle token.
                    color:              "var(--color-subtle)",
                    letterSpacing:      "0.06em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ?? / ?? / ???? · —:——
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px dashed var(--color-line)" }} />

            {/* 404 status badge */}
            <div
              style={{
                padding:        "9px 12px",
                borderRadius:   11,
                background:     "linear-gradient(135deg, var(--color-danger-soft) 0%, var(--color-danger-soft) 100%)",
                border:         "1px solid var(--color-danger-line)",
                display:        "flex",
                alignItems:     "center",
                gap:            8,
              }}
            >
              <div
                style={{
                  width:        7,
                  height:       7,
                  borderRadius: "50%",
                  background:   "var(--color-danger)",
                  flexShrink:   0,
                  boxShadow:    "0 0 0 3px rgba(158,59,46,0.18)",
                }}
              />
              <p style={{ fontSize: 11, fontWeight: 800, color: "var(--color-danger)" }}>
                {code} · الصفحة غير موجودة
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating brand badge (top-right) ── */}
      <div
        className="maw3ed-badge absolute"
        style={{
          top:            38,
          right:          30,
          zIndex:         6,
          width:          50,
          height:         50,
          borderRadius:   "50%",
          background:     "var(--color-surface)",
          border:         "2px solid var(--color-line)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          overflow:       "hidden",
        }}
      >
        <Image
          src="/icon-nobg.png"
          alt="موعد"
          width={32}
          height={32}
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* ── Calendar chip (top-left) ── */}
      <div
        className="maw3ed-chip absolute"
        style={{
          top:        52,
          left:       18,
          zIndex:     5,
          padding:    "7px 12px",
          borderRadius: 14,
          background: "var(--color-surface)",
          border:     "1.5px solid var(--color-line)",
          boxShadow:  "0 4px 16px rgba(17,32,28,0.08)",
          display:    "flex",
          alignItems: "center",
          gap:        7,
          opacity:    0.88,
        }}
      >
        <Calendar size={11} color="var(--color-jade)" />
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-subtle)" }}>؟ موعد</p>
      </div>

      {/* ── "route not found" dark pill (bottom-center) ── */}
      <div
        style={{
          position:       "absolute",
          bottom:         48,
          left:           "50%",
          transform:      "translateX(-50%)",
          zIndex:         5,
          padding:        "7px 16px",
          borderRadius:   100,
          background:     "var(--color-ink)",
          border:         "1px solid var(--color-night-2)",
          boxShadow:      "0 4px 16px rgba(17,32,28,0.22)",
          display:        "flex",
          alignItems:     "center",
          gap:            7,
          whiteSpace:     "nowrap",
        }}
      >
        <div
          style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   "var(--color-danger)",
            boxShadow:    "0 0 0 3px rgba(158,59,46,0.22)",
          }}
        />
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-night-text)", letterSpacing: "0.07em" }}>
          route · not · found
        </p>
        <div
          style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   "var(--color-ink-2)",
          }}
        />
      </div>

      {/* ── Dot cluster (bottom-right) ── */}
      <div
        style={{
          position: "absolute",
          bottom:   90,
          right:    22,
          zIndex:   3,
          display:  "flex",
          flexDirection: "column",
          gap:      6,
        }}
      >
        {[[7, 0.75, "flex-end"], [5, 0.45, "flex-start"], [4, 0.25, "center"]].map(
          ([size, opacity, align], i) => (
            <div key={i} style={{ display: "flex", justifyContent: align as string }}>
              <div
                style={{
                  width:        size as number,
                  height:       size as number,
                  borderRadius: "50%",
                  background:   "var(--color-jade-line)",
                  opacity:      opacity as number,
                }}
              />
            </div>
          ),
        )}
      </div>

      {/* ── Dot cluster (top-center) ── */}
      <div
        style={{
          position: "absolute",
          top:      28,
          left:     "50%",
          transform:"translateX(-50%)",
          zIndex:   3,
          display:  "flex",
          gap:      5,
          alignItems: "center",
        }}
      >
        {[0.2, 0.45, 0.7, 0.45, 0.2].map((op, i) => (
          <div
            key={i}
            style={{
              width:        i === 2 ? 5 : 4,
              height:       i === 2 ? 5 : 4,
              borderRadius: "50%",
              background:   "var(--color-jade-line)",
              opacity:      op,
            }}
          />
        ))}
      </div>

      {/* ── Small location pin chip (bottom-left) ── */}
      <div
        style={{
          position:    "absolute",
          bottom:      95,
          left:        20,
          zIndex:      5,
          padding:     "6px 10px",
          borderRadius: 12,
          background:  "var(--color-surface)",
          border:      "1.5px solid var(--color-line)",
          boxShadow:   "0 3px 10px rgba(17,32,28,0.07)",
          display:     "flex",
          alignItems:  "center",
          gap:         5,
          opacity:     0.75,
        }}
      >
        <div
          style={{
            width:        5,
            height:       5,
            borderRadius: "50%",
            background:   "var(--color-line-2)",
          }}
        />
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "var(--color-surface-3)" }} />
      </div>

    </div>
  );
}
