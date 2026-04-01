"use client";

import type { HeatCell } from "@/app/api/business/analytics/route";

const HOURS    = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 → 21:00
const DAYS_AR  = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"];

function opacity(count: number, max: number): string {
  if (max === 0 || count === 0) return "0";
  return String(Math.max(0.08, count / max));
}

export default function HeatmapChart({ data }: { data: HeatCell[] }) {
  // Build lookup
  const lookup = new Map<string, number>();
  let max = 0;
  for (const c of data) {
    lookup.set(`${c.day}-${c.hour}`, c.count);
    if (c.count > max) max = c.count;
  }

  const isEmpty = data.length === 0;

  return (
    <div className="card p-5">
      <div className="mb-5">
        <h3 className="font-bold text-[var(--color-text-primary)]">أوقات الذروة</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          عدد الحجوزات لكل ساعة ويوم
        </p>
      </div>

      {isEmpty ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-muted)]">لا توجد بيانات في هذه الفترة</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[540px]">
            {/* Hour labels */}
            <div className="flex gap-1 mb-1 ms-10">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[10px] text-[var(--color-text-muted)]"
                  dir="ltr"
                >
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>

            {/* Rows: one per day */}
            <div className="space-y-1">
              {DAYS_AR.map((dayLabel, day) => (
                <div key={day} className="flex items-center gap-1">
                  {/* Day label */}
                  <div className="w-9 text-[11px] font-medium text-[var(--color-text-muted)] text-center shrink-0">
                    {dayLabel}
                  </div>
                  {/* Cells */}
                  {HOURS.map((hour) => {
                    const count = lookup.get(`${day}-${hour}`) ?? 0;
                    return (
                      <div
                        key={hour}
                        title={count > 0 ? `${dayLabel} ${String(hour).padStart(2,"0")}:00 — ${count} حجز` : undefined}
                        className="flex-1 aspect-square rounded-sm transition-all cursor-default"
                        style={{
                          backgroundColor: count > 0 ? "#6366f1" : "var(--color-border)",
                          opacity:         count > 0 ? Number(opacity(count, max)) + 0.15 : 0.35,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-[10px] text-[var(--color-text-muted)]">أقل</span>
              {[0.2, 0.4, 0.6, 0.8, 1].map((op) => (
                <div
                  key={op}
                  className="w-3.5 h-3.5 rounded-sm"
                  style={{ backgroundColor: "#6366f1", opacity: op * 0.85 + 0.15 }}
                />
              ))}
              <span className="text-[10px] text-[var(--color-text-muted)]">أكثر</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
