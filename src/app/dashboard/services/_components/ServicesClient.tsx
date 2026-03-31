"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Clock, ToggleLeft, ToggleRight } from "lucide-react";
import ServicePanel from "./ServicePanel";

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

export default function ServicesClient({ initialServices }: Props) {
  const [services, setServices]   = useState<Service[]>(initialServices);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<Service | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [togglingId, setTogglingId]   = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setPanelOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setPanelOpen(true);
  }

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
          prev.map((x) => x.id === s.id ? { ...x, isAvailable: !x.isAvailable } : x)
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع عن هذا الإجراء.")) return;
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
      isNew ? [...prev, saved] : prev.map((x) => x.id === saved.id ? saved : x)
    );
    setPanelOpen(false);
  }

  const active   = services.filter((s) => s.isAvailable).length;
  const inactive = services.length - active;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">الخدمات</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {active} نشطة · {inactive} مخفية
          </p>
        </div>
        <button onClick={openAdd} className="btn btn-primary gap-2">
          <Plus size={16} />
          إضافة خدمة
        </button>
      </div>

      {/* Empty state */}
      {services.length === 0 && (
        <div className="card p-14 text-center space-y-3">
          <p className="text-4xl">📋</p>
          <p className="font-semibold text-[var(--color-text-primary)]">لا توجد خدمات بعد</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            أضف خدماتك حتى يتمكن العملاء من الحجز
          </p>
          <button onClick={openAdd} className="btn btn-primary mt-2">
            أضف خدمتك الأولى
          </button>
        </div>
      )}

      {/* Services list */}
      {services.length > 0 && (
        <div className="card overflow-hidden p-0 divide-y divide-[var(--color-border)]">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
            >
              {/* Active toggle */}
              <button
                onClick={() => handleToggle(s)}
                disabled={togglingId === s.id}
                className="shrink-0 transition-opacity disabled:opacity-40"
                title={s.isAvailable ? "إخفاء الخدمة" : "تفعيل الخدمة"}
              >
                {s.isAvailable
                  ? <ToggleRight size={28} className="text-[var(--color-accent)]" />
                  : <ToggleLeft  size={28} className="text-gray-400" />
                }
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span
                    className={`text-sm font-semibold ${
                      s.isAvailable
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)] line-through"
                    }`}
                  >
                    {s.nameAr}
                  </span>
                  {s.nameEn && (
                    <span className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                      {s.nameEn}
                    </span>
                  )}
                </div>
                {s.descriptionAr && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5 max-w-sm">
                    {s.descriptionAr}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <Clock size={11} />
                    {s.duration} دقيقة
                  </span>
                  <span className="text-xs font-bold text-[var(--color-accent)]">
                    {s.price.toLocaleString("ar-EG")} {s.currency}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                  title="تعديل"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
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
