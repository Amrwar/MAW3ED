import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: {
    box: "border-[var(--color-info-line)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
    icon: "text-[var(--color-info)]",
    Icon: Info,
  },
  success: {
    box: "border-[var(--color-ok-line)] bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
    icon: "text-[var(--color-ok)]",
    Icon: CheckCircle2,
  },
  warning: {
    box: "border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    icon: "text-[var(--color-warn)]",
    Icon: AlertTriangle,
  },
  danger: {
    box: "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    icon: "text-[var(--color-danger)]",
    Icon: XCircle,
  },
};

/**
 * Inline message attached to the thing it describes — a form that
 * failed, a plan about to expire. Not for transient feedback; that is
 * what the toast is for.
 *
 * `danger` announces itself to screen readers immediately; the quieter
 * tones wait for a pause.
 */
export default function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = t.Icon;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3.5",
        t.box,
        className,
      )}
    >
      <Icon
        size={17}
        strokeWidth={1.9}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", t.icon)}
      />

      <div className="min-w-0 flex-1">
        {title && <p className="m-0 text-[0.875rem] font-bold">{title}</p>}
        {children && (
          <div className={cn("text-[0.8125rem] leading-relaxed", title && "mt-1 opacity-90")}>
            {children}
          </div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
