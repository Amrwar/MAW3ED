import { Images, ArrowLeft } from "lucide-react";

// Subtle gradient palettes for placeholder tiles — feels like tinted photo cards
const TILE_STYLES = [
  { background: "linear-gradient(150deg, #0B1D3A 0%, #1554A0 100%)" },
  { background: "linear-gradient(150deg, #1a1033 0%, #6d28d9 100%)" },
  { background: "linear-gradient(150deg, #0d3321 0%, #059669 100%)" },
  { background: "linear-gradient(150deg, #1f1006 0%, #b45309 100%)" },
  { background: "linear-gradient(150deg, #0c2340 0%, #0e7490 100%)" },
  { background: "linear-gradient(150deg, #2d0a1f 0%, #9d174d 100%)" },
];

export default function GallerySection() {
  return (
    <div
      className="rounded-3xl border p-6 md:p-8"
      style={{
        background:  "#FFFFFF",
        borderColor: "#E2E8F0",
        boxShadow:   "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-6 rounded-full shrink-0"
            style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
          />
          <h2 className="text-xl font-black text-[#0F172A]">الصور</h2>
        </div>
        <button
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#1D4ED8] transition-colors"
        >
          عرض الكل
          <ArrowLeft size={14} />
        </button>
      </div>

      {/* Editorial grid: 1 hero + 2 tall + 3 small */}
      <div className="grid grid-cols-3 grid-rows-2 gap-2.5" style={{ height: 320 }}>
        {/* Hero tile — 2×2 */}
        <div
          className="col-span-2 row-span-2 rounded-2xl overflow-hidden relative group cursor-pointer"
          style={TILE_STYLES[0]}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "rgba(59,130,246,0.15)" }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div
              className="px-4 py-2 rounded-full text-xs font-bold text-white"
              style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }}
            >
              عرض الصورة
            </div>
          </div>
          {/* Subtle texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize:  "20px 20px",
            }}
          />
          <div className="absolute bottom-3 start-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}
            >
              <Images size={16} className="text-white opacity-70" />
            </div>
          </div>
        </div>

        {/* 4 smaller tiles */}
        {TILE_STYLES.slice(1, 5).map((style, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden relative group cursor-pointer"
            style={style}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: "rgba(59,130,246,0.18)" }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
                backgroundSize:  "16px 16px",
              }}
            />
          </div>
        ))}
      </div>

      {/* View all footer */}
      <div
        className="mt-4 pt-4 flex items-center justify-between"
        style={{ borderTop: "1px solid #F1F5F9" }}
      >
        <p className="text-xs text-[#94A3B8]">
          ٦ صور · اضغط لعرض المعرض الكامل
        </p>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{
            background:  "#F8FAFC",
            border:      "1px solid #E2E8F0",
            color:       "#475569",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#BFDBFE";
            el.style.background  = "#EFF6FF";
            el.style.color       = "#1D4ED8";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#E2E8F0";
            el.style.background  = "#F8FAFC";
            el.style.color       = "#475569";
          }}
        >
          <Images size={13} />
          عرض جميع الصور
        </button>
      </div>
    </div>
  );
}
