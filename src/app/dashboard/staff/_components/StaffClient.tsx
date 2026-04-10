"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Scissors, Loader2, CheckCircle2 } from "lucide-react";
import StaffPanel from "./StaffPanel";
import { useLanguage } from "@/contexts/LanguageContext";

export type StaffMember = {
  id:           string;
  nameAr:       string;
  nameEn:       string;
  role:         string;
  photo:        string;
  isActive:     boolean;
  workingDays:  number[];
  specialties:  string[];
  serviceIds:   string[];
  serviceNames: string[];
};

type AvailableService = { id: string; nameAr: string };

type Props = {
  initialStaff:      StaffMember[];
  availableServices: AvailableService[];
};

const DAY_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
function memberGrad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

export default function StaffClient({ initialStaff, availableServices }: Props) {
  const [staff,      setStaff]      = useState<StaffMember[]>(initialStaff);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [editing,    setEditing]    = useState<StaffMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { lang } = useLanguage();
  const isAr = lang === "ar";

  function openAdd()                { setEditing(null); setPanelOpen(true); }
  function openEdit(m: StaffMember) { setEditing(m);    setPanelOpen(true); }

  async function handleDelete(id: string) {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذا الموظف؟" : "Delete this staff member?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/business/staff/${id}`, { method: "DELETE" });
      if (res.ok) setStaff((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(member: StaffMember, isNew: boolean) {
    if (isNew) {
      setStaff((prev) => [...prev, member]);
    } else {
      setStaff((prev) => prev.map((x) => x.id === member.id ? member : x));
    }
    setPanelOpen(false);
  }

  const active = staff.filter((m) => m.isActive);

  return (
    <div>
      {/* ── Page header ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
            {isAr ? "إدارة الفريق" : "Staff Management"}
          </h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>
            {isAr
              ? `${staff.length} موظف · ${active.length} نشط`
              : `${staff.length} members · ${active.length} active`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 transition-all duration-150"
          style={{
            background:   "#0F172A",
            color:        "#FFFFFF",
            border:       "none",
            borderRadius: 12,
            padding:      "10px 18px",
            fontSize:     13,
            fontWeight:   600,
            cursor:       "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
        >
          <Plus size={15} strokeWidth={2.5} />
          {isAr ? "إضافة موظف" : "Add Staff"}
        </button>
      </div>

      {/* ── Empty state ─────────────────────────────── */}
      {staff.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl"
          style={{ minHeight: 280, border: "2px dashed #E2E8F0", gap: 16 }}
        >
          <Scissors size={40} style={{ color: "#CBD5E1" }} />
          <div className="text-center">
            <p style={{ fontSize: 15, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
              {isAr ? "لا يوجد موظفون بعد" : "No staff members yet"}
            </p>
            <p style={{ fontSize: 13, color: "#94A3B8" }}>
              {isAr ? "أضف فريقك لتنظيم المواعيد" : "Add your team to manage appointments"}
            </p>
          </div>
          <button
            onClick={openAdd}
            style={{
              background:   "#0F172A",
              color:        "#FFFFFF",
              border:       "none",
              borderRadius: 10,
              padding:      "9px 18px",
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            {isAr ? "إضافة أول موظف" : "Add first member"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => {
            const isDeleting = deletingId === member.id;
            const dayLabels  = isAr ? DAY_LABELS_AR : DAY_LABELS_EN;

            return (
              <div
                key={member.id}
                className="rounded-2xl p-4 transition-all duration-150"
                style={{
                  background: "#FFFFFF",
                  border:     "1.5px solid #F1F5F9",
                  opacity:    member.isActive ? 1 : 0.6,
                }}
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.nameAr}
                      style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-white shrink-0"
                      style={{
                        width:      44,
                        height:     44,
                        borderRadius: 12,
                        background: memberGrad(member.nameAr),
                        fontSize:   16,
                        fontWeight: 800,
                      }}
                    >
                      {member.nameAr[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>
                      {member.nameAr}
                    </p>
                    {member.role && (
                      <p style={{ fontSize: 12, color: "#64748B" }}>{member.role}</p>
                    )}
                  </div>
                  {!member.isActive && (
                    <span
                      style={{
                        fontSize:   10,
                        fontWeight: 700,
                        padding:    "2px 7px",
                        borderRadius: 100,
                        background: "#FEF2F2",
                        color:      "#EF4444",
                      }}
                    >
                      {isAr ? "غير نشط" : "Inactive"}
                    </span>
                  )}
                </div>

                {/* Services */}
                {member.serviceNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {member.serviceNames.map((name, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize:     11,
                          fontWeight:   500,
                          padding:      "2px 8px",
                          borderRadius: 100,
                          background:   "#EFF6FF",
                          color:        "#1D4ED8",
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Working days */}
                {member.workingDays.length > 0 && (
                  <div className="flex gap-1 mb-4 flex-wrap">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <span
                        key={day}
                        style={{
                          fontSize:     10,
                          fontWeight:   600,
                          padding:      "2px 5px",
                          borderRadius: 6,
                          background:   member.workingDays.includes(day) ? "#0F172A" : "#F1F5F9",
                          color:        member.workingDays.includes(day) ? "#FFFFFF"  : "#CBD5E1",
                        }}
                      >
                        {dayLabels[day]}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(member)}
                    className="flex items-center gap-1.5 transition-all duration-150"
                    style={{
                      flex:           1,
                      justifyContent: "center",
                      padding:        "7px 0",
                      borderRadius:   8,
                      background:     "#F8FAFC",
                      border:         "1.5px solid #E2E8F0",
                      color:          "#475569",
                      fontSize:       12,
                      fontWeight:     500,
                      cursor:         "pointer",
                    }}
                  >
                    <Pencil size={12} />
                    {isAr ? "تعديل" : "Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    disabled={isDeleting}
                    className="flex items-center justify-center transition-all duration-150"
                    style={{
                      width:        34,
                      height:       34,
                      borderRadius: 8,
                      background:   "#FEF2F2",
                      border:       "1.5px solid #FECACA",
                      color:        "#EF4444",
                      cursor:       isDeleting ? "not-allowed" : "pointer",
                    }}
                  >
                    {isDeleting
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Panel ────────────────────────────────────── */}
      <StaffPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSaved={handleSaved}
        editing={editing}
        availableServices={availableServices}
      />
    </div>
  );
}
