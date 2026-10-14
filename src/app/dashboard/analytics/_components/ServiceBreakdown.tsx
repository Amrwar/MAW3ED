"use client";

import { arCount } from "@/lib/fmt";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ServiceSlice } from "@/app/api/business/analytics/route";

const BOOKING = { one: "حجز واحد", two: "حجزين", few: "حجوزات", many: "حجز" };

interface Props {
  data:     ServiceSlice[];
  currency: string;
}

function CustomTooltip({ active, payload, currency }: {
  active?:  boolean;
  payload?: Array<{ payload: ServiceSlice }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-float)] px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-[var(--color-text-primary)] mb-2">{s.serviceName}</p>
      <p className="text-[var(--color-text-secondary)]">{arCount(s.bookings, BOOKING)}</p>
      <p className="font-bold mt-1" style={{ color: s.color }}>
        {s.revenue.toLocaleString("ar-EG-u-nu-latn")} {currency}
      </p>
    </div>
  );
}

export default function ServiceBreakdown({ data, currency }: Props) {
  const total = data.reduce((s, d) => s + d.bookings, 0);

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="font-bold text-[var(--color-text-primary)]">الحجوزات حسب الخدمة</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">توزيع الحجوزات الكلي</p>
      </div>

      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-muted)]">لا توجد بيانات</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut */}
          <div className="shrink-0">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="bookings"
                  nameKey="serviceName"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  strokeWidth={2}
                  stroke="white"
                >
                  {data.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2 min-w-0">
            {data.map((s) => {
              const pct = total > 0 ? Math.round((s.bookings / total) * 100) : 0;
              return (
                <div key={s.serviceName} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                        {s.serviceName}
                      </p>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] shrink-0 min-w-[28px] text-end">
                    {s.bookings}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
