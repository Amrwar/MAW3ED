"use client";

import { arCount } from "@/lib/fmt";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenuePoint } from "@/app/api/business/analytics/route";

const BOOKING = { one: "حجز واحد", two: "حجزين", few: "حجوزات", many: "حجز" };

interface Props {
  data:     RevenuePoint[];
  currency: string;
}

function CustomTooltip({ active, payload, label, currency }: {
  active?:   boolean;
  payload?:  Array<{ value: number }>;
  label?:    string;
  currency:  string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-float)] px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--color-text-primary)] mb-2">{label}</p>
      <p className="text-[var(--color-ok)] font-bold">
        {payload[0].value.toLocaleString("ar-EG-u-nu-latn")} {currency}
      </p>
      {payload[1] && (
        <p className="text-[var(--color-text-muted)] text-xs mt-1">
          {arCount(payload[1].value, BOOKING)}
        </p>
      )}
    </div>
  );
}

export default function RevenueChart({ data, currency }: Props) {
  const hasData = data.some((d) => d.revenue > 0 || d.bookings > 0);

  return (
    <div className="card p-5">
      <div className="mb-5">
        <h3 className="font-bold text-[var(--color-text-primary)]">الإيرادات عبر الزمن</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          الحجوزات المكتملة فقط · {currency}
        </p>
      </div>

      {!hasData ? (
        <div className="h-52 flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-muted)]">لا توجد بيانات في هذه الفترة</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-jade)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="var(--color-jade)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString("ar-EG-u-nu-latn")}
              width={55}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-jade)"
              strokeWidth={2.5}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-jade)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
