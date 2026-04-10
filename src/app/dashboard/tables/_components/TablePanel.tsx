"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import type { Table } from "./TablesClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { TABLE_TYPE_LABELS } from "@/lib/business-type";

const TABLE_TYPES = Object.keys(TABLE_TYPE_LABELS);

interface Props {
  open:    boolean;
  onClose: () => void;
  onSaved: (table: Table, isNew: boolean) => void;
  editing: Table | null;
}

const EMPTY: Omit<Table, "id"> = {
  name:      "",
  tableType: "MIDDLE",
  capacity:  4,
  notes:     "",
  isActive:  true,
};

export default function TablePanel({ open, onClose, onSaved, editing }: Props) {
  const { lang } = useLanguage();
  const isAr     = lang === "ar";

  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : { ...EMPTY });
      setError("");
    }
  }, [open, editing]);

  function set<K extends keyof typeof EMPTY>(key: K, val: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(isAr ? "اسم الطاولة مطلوب" : "Table name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const url    = editing ? `/api/business/tables/${editing.id}` : "/api/business/tables";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? (isAr ? "حدث خطأ" : "Something went wrong"));
        return;
      }
      const saved: Table = await res.json();
      onSaved(saved, !editing);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width:        "100%",
    padding:      "10px 14px",
    borderRadius: 10,
    border:       "1.5px solid #E2E8F0",
    fontSize:     13,
    color:        "#0F172A",
    background:   "#FFFFFF",
    outline:      "none",
    boxSizing:    "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display:      "block",
    fontSize:     12,
    fontWeight:   600,
    color:        "#475569",
    marginBottom: 6,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] md:hidden"
        style={{
          background:    "rgba(15,23,42,0.45)",
          backdropFilter: "blur(3px)",
          opacity:       open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition:    "opacity 0.25s ease",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 end-0 z-[90] h-full flex flex-col"
        style={{
          width:      360,
          maxWidth:   "100vw",
          background: "#FFFFFF",
          boxShadow:  open ? "0 0 40px rgba(15,23,42,0.18)" : "none",
          transform:  open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: 64, borderBottom: "1.5px solid #F1F5F9" }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
            {editing
              ? (isAr ? "تعديل الطاولة" : "Edit Table")
              : (isAr ? "إضافة طاولة"  : "Add Table")}
          </p>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#F8FAFC", border: "1.5px solid #E2E8F0",
              color: "#64748B", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto" style={{ padding: "24px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>
                {isAr ? "اسم الطاولة *" : "Table Name *"}
              </label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={isAr ? "مثال: طاولة 1" : "e.g. Table 1"}
              />
            </div>

            {/* Type */}
            <div>
              <label style={labelStyle}>
                {isAr ? "نوع الطاولة" : "Table Type"}
              </label>
              <select
                style={inputStyle}
                value={form.tableType}
                onChange={(e) => set("tableType", e.target.value)}
              >
                {TABLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {isAr ? TABLE_TYPE_LABELS[type]?.ar : TABLE_TYPE_LABELS[type]?.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label style={labelStyle}>
                {isAr ? "عدد المقاعد" : "Capacity (seats)"}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                style={inputStyle}
                value={form.capacity}
                onChange={(e) => set("capacity", Number(e.target.value))}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>
                {isAr ? "ملاحظات" : "Notes"}
              </label>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={isAr ? "أي تفاصيل إضافية..." : "Any additional details..."}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                {isAr ? "الطاولة نشطة" : "Table is active"}
              </span>
              <button
                type="button"
                onClick={() => set("isActive", !form.isActive)}
                style={{
                  width:        44,
                  height:       24,
                  borderRadius: 100,
                  background:   form.isActive ? "#0F172A" : "#E2E8F0",
                  border:       "none",
                  cursor:       "pointer",
                  position:     "relative",
                  transition:   "background 0.2s",
                }}
              >
                <span
                  style={{
                    position:   "absolute",
                    top:        3,
                    insetInlineStart: form.isActive ? 22 : 3,
                    width:      18,
                    height:     18,
                    borderRadius: 100,
                    background: "#FFFFFF",
                    transition: "inset-inline-start 0.2s",
                    boxShadow:  "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "#EF4444", fontWeight: 500 }}>{error}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div
          className="shrink-0 flex gap-3 px-5 pb-6 pt-4"
          style={{ borderTop: "1.5px solid #F1F5F9" }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex:         1,
              padding:      "11px 0",
              borderRadius: 10,
              background:   "#F8FAFC",
              border:       "1.5px solid #E2E8F0",
              color:        "#475569",
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex:         2,
              padding:      "11px 0",
              borderRadius: 10,
              background:   "#0F172A",
              border:       "none",
              color:        "#FFFFFF",
              fontSize:     13,
              fontWeight:   600,
              cursor:       saving ? "not-allowed" : "pointer",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              gap:          6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving
              ? (isAr ? "جاري الحفظ..." : "Saving...")
              : (editing ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "إضافة الطاولة" : "Add Table"))}
          </button>
        </div>
      </div>
    </>
  );
}
