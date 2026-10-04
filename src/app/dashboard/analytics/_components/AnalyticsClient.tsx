"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import KPICards        from "./KPICards";
import RevenueChart    from "./RevenueChart";
import ServiceBreakdown from "./ServiceBreakdown";
import HeatmapChart    from "./HeatmapChart";
import type { AnalyticsPayload } from "@/app/api/business/analytics/route";

// ── Date helpers ─────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

type Preset = "thisMonth" | "lastMonth" | "last3Months" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();

  switch (p) {
    case "thisMonth":
      return { from: toISO(new Date(y, m, 1)),     to: toISO(now) };
    case "lastMonth":
      return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) };
    case "last3Months":
      return { from: toISO(new Date(y, m - 2, 1)), to: toISO(now) };
    default:
      return { from: toISO(new Date(y, m, 1)),     to: toISO(now) };
  }
}

// ── Component ────────────────────────────────────────────────

interface Props {
  initial: AnalyticsPayload;
}

export default function AnalyticsClient({ initial }: Props) {
  const { t }  = useLanguage();
  const an     = t.dashboard.analytics;

  const PRESETS: Array<{ key: Preset; label: string }> = [
    { key: "thisMonth",   label: an.presets.thisMonth   },
    { key: "lastMonth",   label: an.presets.lastMonth   },
    { key: "last3Months", label: an.presets.last3Months },
    { key: "custom",      label: an.presets.custom      },
  ];

  const [preset,  setPreset]  = useState<Preset>("thisMonth");
  const [from,    setFrom]    = useState(() => presetRange("thisMonth").from);
  const [to,      setTo]      = useState(() => presetRange("thisMonth").to);
  const [data,    setData]    = useState<AnalyticsPayload>(initial);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/business/analytics?from=${f}&to=${t}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(from, to);
  }, [from, to, fetchData]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const range = presetRange(p);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">{an.title}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {an.subtitle}
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={14} className="animate-spin" />
            {an.updating}
          </div>
        )}
      </div>

      {/* Date range filter */}
      <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                preset === p.key
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                  : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand)]/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="input text-sm py-1.5"
              dir="ltr"
            />
            <span className="text-xs text-[var(--color-text-muted)]">{an.to}</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="input text-sm py-1.5"
              dir="ltr"
            />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
        <KPICards kpis={data.kpis} />
      </div>

      {/* Charts row */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}
      >
        <div className="lg:col-span-2">
          <RevenueChart data={data.revenueByPeriod} currency={data.kpis.currency} />
        </div>
        <ServiceBreakdown data={data.bookingsByService} currency={data.kpis.currency} />
      </div>

      {/* Heatmap */}
      <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
        <HeatmapChart data={data.heatmap} />
      </div>
    </div>
  );
}
