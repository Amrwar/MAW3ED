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
  "linear-gradient(135deg,var(--color-jade),var(--color-jade))",
  "linear-gradient(135deg,var(--color-jade),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-ok),var(--color-jade))",
  "linear-gradient(135deg,var(--color-warn),var(--color-star))",
  "linear-gradient(135deg,var(--color-info),var(--color-info))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-danger),var(--color-danger))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
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
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

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
        style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="font-extrabold text-[var(--color-ink)] leading-tight"
              style={{ fontSize: 22, letterSpacing: "-0.02em" }}
            >
              {sv.title}
            </h1>
            <p className="text-sm text-[var(--color-subtle)] mt-1">
              إدارة الخدمات والأسعار ومدة الحجز ·{" "}
              <span className="font-semibold text-[var(--color-muted)]">
                {services.length} {services.length === 1 ? "خدمة" : "خدمات"}
              </span>
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 shrink-0 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={{
              background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
              boxShadow:  "0 4px 14px rgba(14,127,94,0.28)",
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
          icon={<Layers size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={services.length.toLocaleString(locale)}
          label="إجمالي الخدمات"
          sub={`${active} نشطة · ${inactive} موقوفة`}
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} strokeWidth={1.75} style={{ color: "var(--color-ok)" }} />}
          iconBg="var(--color-ok-soft)"
          value={active.toLocaleString(locale)}
          label="الخدمات النشطة"
          sub={
            services.length > 0
              ? `${Math.round((active / services.length) * 100)}% من الإجمالي`
              : "—"
          }
        />
        <SummaryCard
          icon={<Clock size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={services.length > 0 ? `${avgDur} د` : "—"}
          label="متوسط المدة"
          sub="بالدقائق"
        />
        <SummaryCard
          icon={<DollarSign size={16} strokeWidth={1.75} style={{ color: "var(--color-warn)" }} />}
          iconBg="var(--color-warn-soft)"
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
          style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-surface-3)" }}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)]">كل الخدمات</h2>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
              >
                {services.length}
              </span>
              {active > 0 && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--color-ok-soft)", color: "var(--color-ok)" }}
                >
                  {active} نشطة
                </span>
              )}
            </div>
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: "var(--color-line-2)" }} />
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
            background:  "rgba(14,127,94,0.03)",
            borderColor: "rgba(14,127,94,0.15)",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "var(--color-jade-tint)" }}
          >
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-jade)] mb-0.5">نصيحة لتحسين الأداء</p>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
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
      style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-extrabold text-[var(--color-ink)] leading-none"
        style={{ fontSize: 24, letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[var(--color-subtle)] mt-0.5">{sub}</p>}
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
        borderTop:         idx > 0 ? "1px solid var(--color-surface-2)" : "none",
        opacity:           isDeleting ? 0.5 : 1,
        borderInlineStart: `3px solid ${s.isAvailable ? "var(--color-jade)" : "var(--color-line)"}`,
      }}
    >
      {/* Gradient avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold text-white shrink-0"
        style={{
          background: s.isAvailable
            ? svcGrad(s.nameAr)
            : "linear-gradient(135deg,var(--color-line-2),var(--color-subtle))",
        }}
      >
        {s.nameAr[0]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold leading-snug"
            style={{ color: s.isAvailable ? "var(--color-ink)" : "var(--color-subtle)" }}
          >
            {s.nameAr}
          </span>
          {s.nameEn && (
            <span className="text-xs text-[var(--color-subtle)]" dir="ltr">{s.nameEn}</span>
          )}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              s.isAvailable
                ? { background: "var(--color-ok-soft)", color: "var(--color-ok)" }
                : { background: "var(--color-surface-3)", color: "var(--color-subtle)" }
            }
          >
            {s.isAvailable ? "نشطة" : "موقوفة"}
          </span>
        </div>

        {s.descriptionAr && (
          <p className="text-xs text-[var(--color-subtle)] truncate mt-0.5" style={{ maxWidth: 340 }}>
            {s.descriptionAr}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
          >
            <Clock size={10} strokeWidth={1.75} />
            {s.duration} {sv.minutes}
          </span>
          <span
            className="text-sm font-extrabold"
            style={{ color: s.isAvailable ? "var(--color-jade)" : "var(--color-subtle)" }}
          >
            {s.price.toLocaleString(locale)}
            <span className="text-xs font-medium text-[var(--color-subtle)] ms-1">{s.currency}</span>
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
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-subtle)" }} />
        ) : (
          <div
            style={{
              width:        44,
              height:       24,
              borderRadius: 12,
              background:   s.isAvailable ? "var(--color-jade)" : "var(--color-line)",
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
                background:      "var(--color-surface)",
                boxShadow:       "0 1px 4px rgba(17,32,28,0.15)",
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
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
          title={sv.edit}
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>

        <button
          onClick={() => onDelete(s.id)}
          disabled={isDeleting}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-subtle)" }}
          title={sv.delete}
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
      style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
    >
      <div
        className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, var(--color-jade-tint) 0%, var(--color-jade-soft) 100%)",
          border:     "1px solid var(--color-jade-line)",
        }}
      >
        <Layers size={32} strokeWidth={1.5} style={{ color: "var(--color-jade)" }} />
      </div>
      <h3
        className="font-extrabold text-[var(--color-ink)] mb-2"
        style={{ fontSize: 18, letterSpacing: "-0.01em" }}
      >
        لا توجد خدمات بعد
      </h3>
      <p className="text-sm text-[var(--color-subtle)] mb-7 max-w-xs mx-auto leading-relaxed">
        أضف أول خدمة لتبدأ في استقبال الحجوزات من عملائك
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
        style={{
          background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
          boxShadow:  "0 4px 14px rgba(14,127,94,0.28)",
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        إضافة أول خدمة
      </button>
    </div>
  );
}
