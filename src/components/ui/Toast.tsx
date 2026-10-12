"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/useMounted";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Transient feedback — "booking confirmed", "couldn't save".
 *
 * The app already had a toast, but it lived inside DashboardHeader and
 * could only be raised from there, so every other surface fell back to
 * an inline message or nothing. This is the same behaviour lifted out
 * behind a provider, so any component can call `toast()`.
 *
 * For a message attached to a specific thing on the page, use Alert.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  body?: string;
  /** Milliseconds on screen. 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "body">> {
  id: string;
  body?: string;
}

const TONES: Record<ToastTone, { Icon: typeof Info; accent: string; icon: string }> = {
  success: { Icon: CheckCircle2,   accent: "border-s-[var(--color-ok)]",     icon: "text-[var(--color-ok)]" },
  error:   { Icon: XCircle,        accent: "border-s-[var(--color-danger)]", icon: "text-[var(--color-danger)]" },
  warning: { Icon: AlertTriangle,  accent: "border-s-[var(--color-warn)]",   icon: "text-[var(--color-warn)]" },
  info:    { Icon: Info,           accent: "border-s-[var(--color-jade)]",   icon: "text-[var(--color-jade)]" },
};

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Raises a toast. Safe to call outside the provider — it no-ops. */
export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  return ctx ?? (() => {});
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const { lang } = useLanguage();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random());

      const record: ToastRecord = {
        id,
        tone: input.tone ?? "info",
        title: input.title,
        body: input.body,
        duration: input.duration ?? 5000,
      };

      // Cap the stack so a burst of events cannot cover the page.
      setToasts((prev) => [...prev.slice(-3), record]);

      if (record.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), record.duration));
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            // Announced politely so a toast never interrupts what the
            // user is reading, and never steals focus.
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-6 start-6 z-[200] flex flex-col gap-2.5"
          >
            {toasts.map((t) => {
              const { Icon, accent, icon } = TONES[t.tone];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "animate-toast-in pointer-events-auto flex w-[min(22rem,calc(100vw-3rem))] items-start gap-3",
                    "rounded-[var(--radius-md)] border border-s-[3px] border-[var(--color-line)]",
                    "bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-float)]",
                    accent,
                  )}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className={cn("mt-0.5 shrink-0", icon)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
                      {t.title}
                    </p>
                    {t.body && (
                      <p className="m-0 mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-muted)]">
                        {t.body}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}
                    className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center text-[var(--color-subtle)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    <X size={15} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
