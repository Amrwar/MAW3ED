"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Small pieces the Phase 27 dashboard pages share: the input look of
 * the offers page, a labelled field, an Arabic/English picker, a JSON
 * call that never throws, a loader for one GET, and a stat tile.
 */

export const INPUT =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[0.84375rem] outline-none focus:border-[var(--color-jade)]";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[var(--color-subtle)]">
        {label}
      </label>
      {children}
      {hint && <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">{hint}</p>}
    </div>
  );
}

/** The page's language, and `say(ar, en)` to pick a string by it. */
export function useSay() {
  const { lang } = useLanguage();
  const say = useCallback((ar: string, en: string) => (lang === "en" ? en : ar), [lang]);
  return { lang, say };
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string };
}

/** fetch + JSON, with a network failure reported as status 0. */
export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = ((await res?.json().catch(() => ({}))) ?? {}) as T & { error?: string; code?: string };
  return { ok: !!res?.ok, status: res?.status ?? 0, data };
}

/**
 * One GET, loaded on mount and whenever the url changes; `reload` asks
 * again after a change. A reply for a url no longer wanted is dropped.
 */
export function useLoad<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({
    url: null,
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let live = true;
    void api<T>(url).then((r) => {
      if (!live) return;
      setState({
        url,
        data: r.ok ? r.data : null,
        error: r.ok ? null : (r.data.error ?? (r.status === 0 ? "network" : "error")),
      });
    });
    return () => {
      live = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const loading = !!url && state.url !== url;
  return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, loading, reload };
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="m-0 text-[0.75rem] text-[var(--color-subtle)]">{label}</p>
      <p className="num m-0 mt-1 text-[1.25rem] font-bold text-[var(--color-ink)]">{value}</p>
      {hint && <p className="m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">{hint}</p>}
    </div>
  );
}

type Tone = "jade" | "warn" | "muted" | "danger" | "info";
const TONE: Record<Tone, string> = {
  jade: "bg-[var(--color-jade-tint)] text-[var(--color-jade)]",
  warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  muted: "bg-[var(--color-surface-2)] text-[var(--color-subtle)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

export function StatusChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold", TONE[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="m-0 text-[1.375rem] font-bold text-[var(--color-ink)]">{title}</h1>
        {sub && (
          <p className="m-0 mt-1.5 max-w-[65ch] text-[0.875rem] leading-relaxed text-[var(--color-subtle)]">{sub}</p>
        )}
      </div>
      {action}
    </header>
  );
}

/** Service chips to pick from; none picked means every service. */
export function ServicePicker({
  services,
  value,
  onChange,
  legend,
}: {
  services: { id: string; nameAr: string; nameEn?: string | null }[];
  value: string[];
  onChange: (ids: string[]) => void;
  legend: string;
}) {
  const { lang } = useLanguage();
  if (services.length === 0) return null;
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-xs font-semibold text-[var(--color-subtle)]">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => {
          const on = value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
              className={cn(
                "min-h-9 rounded-full border px-3 text-[0.78125rem] transition-colors",
                on
                  ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)]",
              )}
            >
              {lang === "en" && s.nameEn ? s.nameEn : s.nameAr}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Today on the Cairo clock, as YYYY-MM-DD. */
export function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

/** Pounds as typed → piastres, or null when empty or not a number. */
export function poundsToCents(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
