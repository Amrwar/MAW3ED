"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import type { StaffMember } from "./StaffClient";
import { useLanguage } from "@/contexts/LanguageContext";
import ImageUpload from "@/components/shared/ImageUpload";

const DAY_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AvailableService = { id: string; nameAr: string };

interface Props {
  open:              boolean;
  onClose:           () => void;
  onSaved:           (member: StaffMember, isNew: boolean) => void;
  editing:           StaffMember | null;
  availableServices: AvailableService[];
}

type FormState = {
  nameAr:      string;
  nameEn:      string;
  role:        string;
  photo:       string;
  isActive:    boolean;
  workingDays: number[];
  specialties: string[];
  serviceIds:  string[];
};

const EMPTY: FormState = {
  nameAr:      "",
  nameEn:      "",
  role:        "",
  photo:       "",
  isActive:    true,
  workingDays: [0, 1, 2, 3, 4],
  specialties: [],
  serviceIds:  [],
};

export default function StaffPanel({ open, onClose, onSaved, editing, availableServices }: Props) {
  const { lang } = useLanguage();
  const isAr     = lang === "ar";

  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              nameAr:      editing.nameAr,
              nameEn:      editing.nameEn,
              role:        editing.role,
              photo:       editing.photo,
              isActive:    editing.isActive,
              workingDays: editing.workingDays,
              specialties: editing.specialties,
              serviceIds:  editing.serviceIds,
            }
          : { ...EMPTY },
      );
      setError("");
    }
  }, [open, editing]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter((d) => d !== day)
        : [...f.workingDays, day].sort(),
    }));
  }

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      setError(isAr ? "اسم الموظف مطلوب" : "Staff name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const url    = editing ? `/api/business/staff/${editing.id}` : "/api/business/staff";
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
      const raw = await res.json();
      // Normalize returned data to StaffMember shape
      const saved: StaffMember = {
        id:           raw.id,
        nameAr:       raw.nameAr,
        nameEn:       raw.nameEn ?? "",
        role:         raw.role ?? "",
        photo:        raw.photo ?? "",
        isActive:     raw.isActive,
        workingDays:  raw.workingDays ?? [],
        specialties:  raw.specialties ?? [],
        serviceIds:   (raw.services ?? []).map((ss: { serviceId: string }) => ss.serviceId),
        serviceNames: (raw.services ?? []).map((ss: { service: { nameAr: string } }) => ss.service.nameAr),
      };
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

  const dayLabels = isAr ? DAY_LABELS_AR : DAY_LABELS_EN;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80]"
        style={{
          background:     "rgba(17,32,28,0.45)",
          backdropFilter: "blur(3px)",
          opacity:        open ? 1 : 0,
          pointerEvents:  open ? "auto" : "none",
          transition:     "opacity 0.25s ease",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 end-0 z-[90] h-full flex flex-col"
        style={{
          width:      400,
          maxWidth:   "100vw",
          background: "var(--color-surface)",
          boxShadow:  open ? "0 0 40px rgba(17,32,28,0.18)" : "none",
          transform:  open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: 64, borderBottom: "1.5px solid var(--color-surface-3)" }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink)" }}>
            {editing
              ? (isAr ? "تعديل بيانات الموظف" : "Edit Staff Member")
              : (isAr ? "إضافة موظف جديد"     : "Add Staff Member")}
          </p>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--color-surface-2)", border: "1.5px solid var(--color-line)",
              color: "var(--color-muted)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto" style={{ padding: "24px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Name AR */}
            <div>
              <label style={labelStyle}>{isAr ? "الاسم (عربي) *" : "Name (Arabic) *"}</label>
              <input
                style={inputStyle}
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                placeholder={isAr ? "مثال: محمد أحمد" : "e.g. محمد أحمد"}
              />
            </div>

            {/* Name EN */}
            <div>
              <label style={labelStyle}>{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</label>
              <input
                style={inputStyle}
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                placeholder="e.g. Mohamed Ahmed"
              />
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>{isAr ? "المنصب / الدور" : "Role / Title"}</label>
              <input
                style={inputStyle}
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder={isAr ? "مثال: حلاق أول" : "e.g. Senior Barber"}
              />
            </div>

            {/* Photo */}
            <div>
              <label style={labelStyle}>{isAr ? "صورة الموظف" : "Staff Photo"}</label>
              <ImageUpload
                variant="logo"
                value={form.photo || null}
                onChange={(url) => set("photo", url)}
                onRemove={() => set("photo", "")}
                folder="maw3ed/staff"
                label={isAr ? "JPG أو PNG · حتى 5MB" : "JPG or PNG · up to 5MB"}
              />
            </div>

            {/* Services */}
            {availableServices.length > 0 && (
              <div>
                <label style={labelStyle}>{isAr ? "الخدمات المُقدَّمة" : "Services Offered"}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {availableServices.map((svc) => (
                    <label
                      key={svc.id}
                      style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          10,
                        padding:      "9px 12px",
                        borderRadius: 8,
                        border:       `1.5px solid ${form.serviceIds.includes(svc.id) ? "var(--color-jade)" : "var(--color-line)"}`,
                        background:   form.serviceIds.includes(svc.id) ? "var(--color-jade-tint)" : "var(--color-surface)",
                        cursor:       "pointer",
                        fontSize:     13,
                        fontWeight:   500,
                        color:        form.serviceIds.includes(svc.id) ? "var(--color-jade)" : "var(--color-muted)",
                        transition:   "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ display: "none" }}
                        checked={form.serviceIds.includes(svc.id)}
                        onChange={() => toggleService(svc.id)}
                      />
                      <span style={{ flex: 1 }}>{svc.nameAr}</span>
                      {form.serviceIds.includes(svc.id) && (
                        <div
                          style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: "var(--color-jade)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Working days */}
            <div>
              <label style={labelStyle}>{isAr ? "أيام العمل" : "Working Days"}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {dayLabels.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    style={{
                      padding:      "6px 10px",
                      borderRadius: 8,
                      border:       `1.5px solid ${form.workingDays.includes(i) ? "var(--color-ink)" : "var(--color-line)"}`,
                      background:   form.workingDays.includes(i) ? "var(--color-ink)" : "var(--color-surface-2)",
                      color:        form.workingDays.includes(i) ? "var(--color-surface)"  : "var(--color-muted)",
                      fontSize:     12,
                      fontWeight:   600,
                      cursor:       "pointer",
                      transition:   "all 0.15s",
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                {isAr ? "الموظف نشط" : "Staff member is active"}
              </span>
              <button
                type="button"
                onClick={() => set("isActive", !form.isActive)}
                style={{
                  width:      44,
                  height:     24,
                  borderRadius: 100,
                  background: form.isActive ? "var(--color-ink)" : "var(--color-line)",
                  border:     "none",
                  cursor:     "pointer",
                  position:   "relative",
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    position:         "absolute",
                    top:              3,
                    insetInlineStart: form.isActive ? 22 : 3,
                    width:            18,
                    height:           18,
                    borderRadius:     100,
                    background:       "var(--color-surface)",
                    transition:       "inset-inline-start 0.2s",
                    boxShadow:        "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "var(--color-danger)", fontWeight: 500 }}>{error}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div
          className="shrink-0 flex gap-3 px-5 pb-6 pt-4"
          style={{ borderTop: "1.5px solid var(--color-surface-3)" }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex:         1,
              padding:      "11px 0",
              borderRadius: 10,
              background:   "var(--color-surface-2)",
              border:       "1.5px solid var(--color-line)",
              color:        "var(--color-muted)",
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
              flex:           2,
              padding:        "11px 0",
              borderRadius:   10,
              background:     "var(--color-ink)",
              border:         "none",
              color:          "var(--color-surface)",
              fontSize:       13,
              fontWeight:     600,
              cursor:         saving ? "not-allowed" : "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving
              ? (isAr ? "جاري الحفظ..." : "Saving...")
              : (editing ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "إضافة الموظف" : "Add Member"))}
          </button>
        </div>
      </div>
    </>
  );
}
