"use client";

import { useState, useEffect } from "react";
import type { Table } from "./TablesClient";
import { useLanguage } from "@/contexts/LanguageContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
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
    border:       "1.5px solid var(--color-line)",
    fontSize:     13,
    color:        "var(--color-ink)",
    background:   "var(--color-surface)",
    outline:      "none",
    boxSizing:    "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display:      "block",
    fontSize:     12,
    fontWeight:   600,
    color:        "var(--color-muted)",
    marginBottom: 6,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title={editing ? (isAr ? "تعديل الطاولة" : "Edit Table") : (isAr ? "إضافة طاولة" : "Add Table")}
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="table-form"
            variant="primary"
            isLoading={saving}
            className="flex-[2]"
          >
            {editing
              ? (isAr ? "حفظ التعديلات" : "Save Changes")
              : (isAr ? "إضافة الطاولة" : "Add Table")}
          </Button>
        </div>
      }
    >
      <form id="table-form" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-[var(--space-5)]">

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
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                {isAr ? "الطاولة نشطة" : "Table is active"}
              </span>
              <button
                type="button"
                onClick={() => set("isActive", !form.isActive)}
                style={{
                  width:        44,
                  height:       24,
                  borderRadius: 100,
                  background:   form.isActive ? "var(--color-ink)" : "var(--color-line)",
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
                    background: "var(--color-surface)",
                    transition: "inset-inline-start 0.2s",
                    boxShadow:  "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </form>
    </Modal>
  );
}
