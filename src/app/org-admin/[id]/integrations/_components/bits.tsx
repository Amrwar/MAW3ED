"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { api, useSay } from "@/components/dashboard/kit";
import { localeFor } from "@/lib/fmt";
import type { Lang } from "@/lib/i18n";

/** A date and time on the Cairo clock, or a dash. */
export function at(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * useLoad, keeping the HTTP status too: the owner-only routes answer 404
 * to anyone else, and a section hides itself on that rather than showing
 * an error.
 */
export function useOwnerLoad<T>(url: string) {
  const [state, setState] = useState<{ status: number | null; data: T | null; error: string | null }>({
    status: null,
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void api<T>(url).then((r) => {
      if (!live) return;
      setState({
        status: r.status,
        data: r.ok ? r.data : null,
        error: r.ok ? null : (r.data.error ?? (r.status === 0 ? "network" : "error")),
      });
    });
    return () => {
      live = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, loading: state.status === null, hidden: state.status === 404, reload };
}

export function Spinner() {
  const { say } = useSay();
  return (
    <p className="m-0 text-sm text-[var(--color-subtle)]" role="status">
      <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
      {say("بيحمّل…", "Loading…")}
    </p>
  );
}

/**
 * A key or signing secret, shown the one time the server hands it over.
 * Nothing keeps it: once this box is closed it is gone, which the warning
 * says plainly.
 */
export function SecretOnce({
  id,
  label,
  value,
  onDone,
}: {
  id: string;
  label: string;
  value: string;
  onDone: () => void;
}) {
  const { say } = useSay();
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border-2 border-[var(--color-warn)] bg-[var(--color-warn-soft)] p-4">
      <p className="m-0 text-sm font-bold text-[var(--color-ink)]" role="alert">
        {say(
          "انسخه دلوقتي واحفظه في مكان آمن — مش هيظهر تاني أبدًا. لو ضاع، اعمل واحد جديد.",
          "Copy it now and keep it somewhere safe — it will never be shown again. If it is lost, make a new one.",
        )}
      </p>
      <label htmlFor={id} className="block text-xs font-semibold text-[var(--color-subtle)]">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          readOnly
          value={value}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[0.78125rem]"
        />
        <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => void copy()}>
          {copied === "yes" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied === "yes" ? say("اتنسخ", "Copied") : say("انسخ", "Copy")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          {say("خلاص، حفظته", "Done, I saved it")}
        </button>
      </div>
      <p className="m-0 min-h-4 text-xs" role="status">
        {copied === "failed" && say("مقدرناش ننسخ — حدّده وانسخه بإيدك.", "Couldn't copy — select it and copy by hand.")}
      </p>
    </div>
  );
}
