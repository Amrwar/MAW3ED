"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Utensils, Loader2 } from "lucide-react";
import TablePanel from "./TablePanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { TABLE_TYPE_LABELS } from "@/lib/business-type";

export type Table = {
  id:        string;
  name:      string;
  tableType: string;
  capacity:  number;
  notes:     string;
  isActive:  boolean;
};

type Props = { initialTables: Table[] };

const TYPE_COLORS: Record<string, string> = {
  CORNER:  "linear-gradient(135deg,#0E7490,#22D3EE)",
  MIDDLE:  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  OUTDOOR: "linear-gradient(135deg,#059669,#34D399)",
  WINDOW:  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  FAMILY:  "linear-gradient(135deg,#B45309,#F59E0B)",
  PRIVATE: "linear-gradient(135deg,#9D174D,#F472B6)",
  BAR:     "linear-gradient(135deg,#DC2626,#F87171)",
  BOOTH:   "linear-gradient(135deg,#4338CA,#818CF8)",
};

export default function TablesClient({ initialTables }: Props) {
  const [tables,     setTables]     = useState<Table[]>(initialTables);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [editing,    setEditing]    = useState<Table | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { t, lang } = useLanguage();
  const isAr = lang === "ar";

  function openAdd()           { setEditing(null); setPanelOpen(true); }
  function openEdit(tb: Table) { setEditing(tb);   setPanelOpen(true); }

  async function handleDelete(id: string) {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه الطاولة؟" : "Delete this table?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/business/tables/${id}`, { method: "DELETE" });
      if (res.ok) setTables((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(table: Table, isNew: boolean) {
    if (isNew) {
      setTables((prev) => [...prev, table]);
    } else {
      setTables((prev) => prev.map((x) => x.id === table.id ? table : x));
    }
    setPanelOpen(false);
  }

  const active   = tables.filter((t) => t.isActive);
  const inactive = tables.filter((t) => !t.isActive);
  const totalCap = active.reduce((sum, t) => sum + t.capacity, 0);

  return (
    <div>
      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
            {isAr ? "إدارة الطاولات" : "Table Management"}
          </h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>
            {isAr
              ? `${tables.length} طاولة · ${active.length} نشطة · ${totalCap} مقعد إجمالي`
              : `${tables.length} tables · ${active.length} active · ${totalCap} total seats`}
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
          {isAr ? "إضافة طاولة" : "Add Table"}
        </button>
      </div>

      {/* ── Stats row ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: isAr ? "إجمالي الطاولات" : "Total Tables", value: tables.length, icon: Utensils },
          { label: isAr ? "الطاولات النشطة" : "Active Tables", value: active.length,  icon: Utensils },
          { label: isAr ? "إجمالي المقاعد"  : "Total Seats",   value: totalCap,        icon: Users   },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{ background: "#FFFFFF", border: "1.5px solid #F1F5F9" }}
          >
            <p style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginBottom: 6 }}>{stat.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tables grid ───────────────────────────────── */}
      {tables.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl"
          style={{
            minHeight: 280,
            border:    "2px dashed #E2E8F0",
            gap:       16,
          }}
        >
          <Utensils size={40} style={{ color: "#CBD5E1" }} />
          <div className="text-center">
            <p style={{ fontSize: 15, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
              {isAr ? "لا توجد طاولات بعد" : "No tables yet"}
            </p>
            <p style={{ fontSize: 13, color: "#94A3B8" }}>
              {isAr ? "أضف طاولاتك لتنظيم الحجوزات" : "Add tables to manage reservations"}
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
            {isAr ? "إضافة أول طاولة" : "Add first table"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => {
            const typeLabel = TABLE_TYPE_LABELS[table.tableType];
            const gradient  = TYPE_COLORS[table.tableType] ?? TYPE_COLORS.MIDDLE;
            const isDeleting = deletingId === table.id;

            return (
              <div
                key={table.id}
                className="rounded-2xl overflow-hidden transition-all duration-150"
                style={{
                  background: "#FFFFFF",
                  border:     "1.5px solid #F1F5F9",
                  opacity:    table.isActive ? 1 : 0.6,
                }}
              >
                {/* Color strip */}
                <div style={{ height: 6, background: gradient }} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>
                        {table.name}
                      </p>
                      <span
                        style={{
                          display:      "inline-block",
                          fontSize:     11,
                          fontWeight:   600,
                          padding:      "2px 8px",
                          borderRadius: 100,
                          background:   "#F1F5F9",
                          color:        "#475569",
                        }}
                      >
                        {isAr ? typeLabel?.ar : typeLabel?.en}
                      </span>
                    </div>
                    {!table.isActive && (
                      <span
                        style={{
                          fontSize:     10,
                          fontWeight:   700,
                          padding:      "2px 8px",
                          borderRadius: 100,
                          background:   "#FEF2F2",
                          color:        "#EF4444",
                        }}
                      >
                        {isAr ? "غير نشطة" : "Inactive"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-4" style={{ color: "#64748B" }}>
                    <Users size={13} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {table.capacity} {isAr ? "مقعد" : "seats"}
                    </span>
                  </div>

                  {table.notes && (
                    <p
                      className="mb-4"
                      style={{
                        fontSize:     12,
                        color:        "#94A3B8",
                        lineHeight:   1.5,
                        overflow:     "hidden",
                        display:      "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      } as React.CSSProperties}
                    >
                      {table.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(table)}
                      className="flex items-center gap-1.5 transition-all duration-150"
                      style={{
                        flex:         1,
                        justifyContent: "center",
                        padding:      "7px 0",
                        borderRadius: 8,
                        background:   "#F8FAFC",
                        border:       "1.5px solid #E2E8F0",
                        color:        "#475569",
                        fontSize:     12,
                        fontWeight:   500,
                        cursor:       "pointer",
                      }}
                    >
                      <Pencil size={12} />
                      {isAr ? "تعديل" : "Edit"}
                    </button>
                    <button
                      onClick={() => handleDelete(table.id)}
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
              </div>
            );
          })}
        </div>
      )}

      {/* ── Slide-over panel ──────────────────────────── */}
      <TablePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />
    </div>
  );
}
