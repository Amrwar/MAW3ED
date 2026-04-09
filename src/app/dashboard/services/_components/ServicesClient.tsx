"use client";

import { useState } from "react";
import {
  Plus, Pencil, Trash2, Clock, DollarSign,
  Layers, CheckCircle2, TrendingUp, Loader2,
} from "lucide-react";
import ServicePanel from "./ServicePanel";
import { useLanguage } from "@/contexts/LanguageContext";

export type Service = {
  id:            string;
  nameAr:        string;
  nameEn:        string;
  descriptionAr: string;
  duration:      number;
  price:         number;
  currency:      string;
  isAvailable:   boolean;
  sortOrder:     number;
};

type Props = { initialServices: Service[] };

// Deterministic gradient per service name initial
const GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
  "linear-gradient(135deg,#DC2626,#F87171)",
  "linear-gradient(135deg,#4338CA,#818CF8)",
];
function svcGrad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

export default function ServicesClient({ initialServices }: Props) {
  const [services,   setServices]   = useState<Service[]>(initialServices);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [editing,    setEditing]    = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { t, lang } = useLanguage();
  const sv     = t.dashboard.services;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  function openAdd()          { setEditing(null); setPanelOpen(true); }
  function openEdit(s: Service) { setEditing(s);   setPanelOpen(true); }

  async function handleToggle(s: Service) {
    setTogglingId(s.id);
    try {
      const res = await fetch(`/api/business/services/${s.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isAvailable: !s.isAvailable }),
      });
      if (res.ok) {
        setServices((prev) =>
          prev.map((x) => x.id === s.id ? { ...x, isAvailable: !x.isAvailable } : x),
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(sv.deleteConfirm)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/business/services/${id}`, { method: "DELETE" });
      if (res.ok) setServices((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSave(saved: Service, isNew: boolean) {
    setServices((prev) =>
      isNew ? [...prev, saved] : prev.map((x) => x.id === saved.id ? saved : x),
    );
    setPanelOpen(false);
  }

  const active   = services.filter((s) => s.isAvailable).length;
  const inactive = services.length - active;
  const avgDur   = services.length
    ? Math.round(services.reduce((a, s) => a + s.duration, 0) / services.length)
    : 0;
  const avgPrice = services.length
    ? Math.round(services.reduce((a, s) => a + s.price, 0) / services.length)
    : 0;
  const currency = services[0]?.currency ?? "EGP";

  return (
    <div className="space-y-5">

      {/* ── Premium page header ── */}
      <div
        className="rounded-2xl border bg-white px-6 py-5"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="font-black text-[#0F172A] leading-tight"
              style={{ fontSize: 22, letterSpacing: "-0.02em" }}
            >
              {sv.title}
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              إدارة الخدمات والأسعار ومدة الحجز ·{" "}
              <span className="font-semibold text-[#475569]">
                {services.length} {services.length === 1 ? "خدمة" : "خدمات"}
              </span>
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 shrink-0"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(59,130,246,0.38)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(59,130,246,0.28)";
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            {sv.addBtn}
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Layers size={16} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          iconBg="#EFF6FF"
          value={services.length.toLocaleString(locale)}
          label="إجمالي الخدمات"
          sub={`${active} نشطة · ${inactive} موقوفة`}
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} strokeWidth={1.75} style={{ color: "#059669" }} />}
          iconBg="#F0FDF4"
          value={active.toLocaleString(locale)}
          label="الخدمات النشطة"
          sub={
            services.length > 0
              ? `${Math.round((active / services.length) * 100)}% من الإجمالي`
              : "—"
          }
        />
        <SummaryCard
          icon={<Clock size={16} strokeWidth={1.75} style={{ color: "#7C3AED" }} />}
          iconBg="#F5F3FF"
          value={services.length > 0 ? `${avgDur} د` : "—"}
          label="متوسط المدة"
          sub="بالدقائق"
        />
        <SummaryCard
          icon={<DollarSign size={16} strokeWidth={1.75} style={{ color: "#B45309" }} />}
          iconBg="#FFFBEB"
          value={services.length > 0 ? avgPrice.toLocaleString(locale) : "—"}
          label="متوسط السعر"
          sub={currency}
        />
      </div>

      {/* ── Services section ── */}
      {services.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <div
          className="rounded-2xl border bg-white overflow-hidden"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid #F1F5F9" }}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-[#0F172A]">كل الخدمات</h2>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#F1F5F9", color: "#64748B" }}
              >
                {services.length}
              </span>
              {active > 0 && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#DCFCE7", color: "#15803D" }}
                >
                  {active} نشطة
                </span>
              )}
            </div>
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: "#CBD5E1" }} />
          </div>

          {/* Service rows */}
          {services.map((s, idx) => (
            <ServiceRow
              key={s.id}
              service={s}
              idx={idx}
              locale={locale}
              sv={sv}
              togglingId={togglingId}
              deletingId={deletingId}
              onToggle={handleToggle}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Tip card ── */}
      {services.length > 0 && (
        <div
          className="rounded-2xl border px-5 py-4 flex items-start gap-4"
          style={{
            background:  "rgba(59,130,246,0.03)",
            borderColor: "rgba(59,130,246,0.15)",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#EFF6FF" }}
          >
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1D4ED8] mb-0.5">نصيحة لتحسين الأداء</p>
            <p className="text-xs text-[#475569] leading-relaxed">
              الخدمات التي تحتوي على وصف واضح تحصل على حجوزات أكثر بنسبة تصل إلى 40%.
              تأكد من إضافة وصف مفصل لكل خدمة لزيادة معدل الحجز.
            </p>
          </div>
        </div>
      )}

      <ServicePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon, iconBg, value, label, sub,
}: {
  icon:   React.ReactNode;
  iconBg: string;
  value:  string;
  label:  string;
  sub?:   string;
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
        className="font-black text-[#0F172A] leading-none"
        style={{ fontSize: 24, letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[#475569] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Service row ──────────────────────────────────────────────────────────────

function ServiceRow({
  service: s,
  idx,
  locale,
  sv,
  togglingId,
  deletingId,
  onToggle,
  onEdit,
  onDelete,
}: {
  service:    Service;
  idx:        number;
  locale:     string;
  sv:         Record<string, string>;
  togglingId: string | null;
  deletingId: string | null;
  onToggle:   (s: Service) => void;
  onEdit:     (s: Service) => void;
  onDelete:   (id: string) => void;
}) {
  const isToggling = togglingId === s.id;
  const isDeleting = deletingId === s.id;

  return (
    <div
      className="flex items-center gap-4 px-6 py-4 transition-colors"
      style={{
        borderTop:         idx > 0 ? "1px solid #F8FAFC" : "none",
        opacity:           isDeleting ? 0.5 : 1,
        borderInlineStart: `3px solid ${s.isAvailable ? "#3B82F6" : "#E2E8F0"}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#FAFBFD";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Gradient avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
        style={{
          background: s.isAvailable
            ? svcGrad(s.nameAr)
            : "linear-gradient(135deg,#CBD5E1,#94A3B8)",
        }}
      >
        {s.nameAr[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold leading-snug"
            style={{ color: s.isAvailable ? "#0F172A" : "#94A3B8" }}
          >
            {s.nameAr}
          </span>
          {s.nameEn && (
            <span className="text-xs text-[#94A3B8]" dir="ltr">{s.nameEn}</span>
          )}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              s.isAvailable
                ? { background: "#DCFCE7", color: "#15803D" }
                : { background: "#F1F5F9", color: "#94A3B8" }
            }
          >
            {s.isAvailable ? "نشطة" : "موقوفة"}
          </span>
        </div>

        {s.descriptionAr && (
          <p className="text-xs text-[#94A3B8] truncate mt-0.5" style={{ maxWidth: 340 }}>
            {s.descriptionAr}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg"
            style={{ background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}
          >
            <Clock size={10} strokeWidth={1.75} />
            {s.duration} {sv.minutes}
          </span>
          <span
            className="text-sm font-black"
            style={{ color: s.isAvailable ? "#1D4ED8" : "#94A3B8" }}
          >
            {s.price.toLocaleString(locale)}
            <span className="text-xs font-medium text-[#94A3B8] ms-1">{s.currency}</span>
          </span>
        </div>
      </div>

      {/* Visibility toggle */}
      <button
        onClick={() => onToggle(s)}
        disabled={isToggling}
        title={s.isAvailable ? sv.hideService : sv.showService}
        aria-label={s.isAvailable ? sv.hideService : sv.showService}
        className="shrink-0 transition-opacity disabled:opacity-40"
      >
        {isToggling ? (
          <Loader2 size={20} className="animate-spin" style={{ color: "#94A3B8" }} />
        ) : (
          <div
            style={{
              width:        44,
              height:       24,
              borderRadius: 12,
              background:   s.isAvailable ? "#1D4ED8" : "#E2E8F0",
              transition:   "background 0.2s",
              position:     "relative",
              flexShrink:   0,
            }}
          >
            <div
              style={{
                position:        "absolute",
                width:           18,
                height:          18,
                borderRadius:    "50%",
                background:      "#FFFFFF",
                boxShadow:       "0 1px 4px rgba(15,23,42,0.15)",
                top:             3,
                insetInlineStart: s.isAvailable ? "unset" : 3,
                insetInlineEnd:   s.isAvailable ? 3 : "unset",
                transition:      "inset 0.2s",
              }}
            />
          </div>
        )}
      </button>

      {/* Edit / Delete */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(s)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569" }}
          title={sv.edit}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = "#EFF6FF";
            el.style.borderColor = "#BFDBFE";
            el.style.color       = "#1D4ED8";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = "#F8FAFC";
            el.style.borderColor = "#E2E8F0";
            el.style.color       = "#475569";
          }}
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>

        <button
          onClick={() => onDelete(s.id)}
          disabled={isDeleting}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
          style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#94A3B8" }}
          title={sv.delete}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = "#FEF2F2";
            el.style.borderColor = "#FECACA";
            el.style.color       = "#EF4444";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = "#F8FAFC";
            el.style.borderColor = "#E2E8F0";
            el.style.color       = "#94A3B8";
          }}
        >
          {isDeleting
            ? <Loader2 size={13} className="animate-spin" />
            : <Trash2 size={13} strokeWidth={1.75} />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="rounded-2xl border bg-white py-20 px-8 text-center"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      <div
        className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
          border:     "1px solid #BFDBFE",
        }}
      >
        <Layers size={32} strokeWidth={1.5} style={{ color: "#3B82F6" }} />
      </div>
      <h3
        className="font-black text-[#0F172A] mb-2"
        style={{ fontSize: 18, letterSpacing: "-0.01em" }}
      >
        لا توجد خدمات بعد
      </h3>
      <p className="text-sm text-[#94A3B8] mb-7 max-w-xs mx-auto leading-relaxed">
        أضف أول خدمة لتبدأ في استقبال الحجوزات من عملائك
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
          boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.filter = "";
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        إضافة أول خدمة
      </button>
    </div>
  );
}
