"use client";

import { allowedScopes, SCOPE_LABELS } from "@/lib/organizations/scopes";

/**
 * Checkboxes for delegation scopes, offering exactly the ones the
 * relationship may carry (none for HOSTED, finance only for OWNED,
 * reservations only for a single branch) — the same rule the server
 * and the database enforce.
 */
export default function ScopePicker({
  relation,
  branchId = null,
  value,
  onChange,
  en,
  legend,
}: {
  relation: string;
  branchId?: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  en: boolean;
  legend: string;
}) {
  const allowed = allowedScopes(relation, branchId);
  if (!allowed.length) return null;
  return (
    <fieldset className="m-0 space-y-1 border-0 p-0">
      <legend className="mb-1 text-xs font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {allowed.map((s) => (
          <label key={s} className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={value.includes(s)}
              onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))}
            />
            {en ? SCOPE_LABELS[s][1] : SCOPE_LABELS[s][0]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
