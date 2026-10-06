"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Filters kept in the URL, so a filtered log can be linked to. */
export default function AuditFilters({
  action,
  resource,
  actions,
  resources,
}: {
  action: string;
  resource: string;
  actions: { id: string; n: number }[];
  resources: { id: string; n: number }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/admin/audit?${next.toString()}`);
  }

  if (actions.length === 0 && resources.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Chip active={!resource && !action} onClick={() => router.push("/admin/audit")}>
        الكل
      </Chip>
      {resources.map((r) => (
        <Chip key={r.id} active={resource === r.id} onClick={() => go({ resource: r.id, action: null })}>
          {r.id} <span className="num opacity-70">{r.n}</span>
        </Chip>
      ))}
      {actions.map((a) => (
        <Chip key={a.id} active={action === a.id} onClick={() => go({ action: a.id, resource: null })}>
          <span dir="ltr">{a.id}</span> <span className="num opacity-70">{a.n}</span>
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 rounded-full border px-3 text-[0.75rem] transition-colors",
        active
          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]",
      )}
    >
      {children}
    </button>
  );
}
