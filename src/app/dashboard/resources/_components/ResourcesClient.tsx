"use client";

import { useState } from "react";
import { countText } from "@/lib/i18n";
import { Armchair, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { RESOURCE_KIND_LABELS } from "@/lib/scheduling/resource-labels";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

export interface ResourceRow {
  id: string;
  name: string;
  kind: keyof typeof RESOURCE_KIND_LABELS;
  capacity: number | null;
  area: string | null;
  notes: string | null;
  isActive: boolean;
  branchId: string | null;
  branch: { id: string; nameAr: string } | null;
  _count: { bookings: number };
}

interface Props {
  initial: ResourceRow[];
  branches: { id: string; nameAr: string }[];
}

const KINDS = ["ROOM", "CHAIR", "TABLE", "EQUIPMENT", "OTHER"] as const;

/**
 * Rooms, chairs, tables and equipment — one page.
 *
 * The page this replaces was /dashboard/tables and only a restaurant
 * could reach it. A clinic has treatment rooms and a gym has machines;
 * they hold a booking the same way a table does, so they are managed
 * the same way.
 */
export default function ResourcesClient({ initial, branches }: Props) {
  const { t, lang } = useLanguage();
  const r = t.resources;
  const isAr = lang === "ar";

  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = creating || editing !== null;

  const [form, setForm] = useState({
    name: "",
    kind: "OTHER" as ResourceRow["kind"],
    capacity: "",
    area: "",
    notes: "",
    branchId: "",
    isActive: true,
  });

  function startCreate() {
    setForm({ name: "", kind: "OTHER", capacity: "", area: "", notes: "", branchId: "", isActive: true });
    setError(null);
    setCreating(true);
  }

  function startEdit(row: ResourceRow) {
    setForm({
      name: row.name,
      kind: row.kind,
      capacity: row.capacity === null ? "" : String(row.capacity),
      area: row.area ?? "",
      notes: row.notes ?? "",
      branchId: row.branchId ?? "",
      isActive: row.isActive,
    });
    setError(null);
    setEditing(row);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      // An empty box means "this does not count anything", not zero.
      capacity: form.capacity.trim() ? Number(form.capacity) : null,
      area: form.area.trim() || null,
      notes: form.notes.trim() || null,
      branchId: form.branchId || null,
      isActive: form.isActive,
    };

    try {
      const res = await fetch(
        editing ? `/api/business/resources/${editing.id}` : "/api/business/resources",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? r.saveError);
        return;
      }

      setRows((prev) =>
        editing
          ? prev.map((x) => (x.id === editing.id ? data.resource : x))
          : [...prev, data.resource],
      );
      close();
    } catch {
      setError(r.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ResourceRow) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/business/resources/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return;

      if (data.deactivated) {
        // Kept, because bookings point at it.
        setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, isActive: false } : x)));
        setNotice(countText(lang, data.bookings, r.deactivated));
      } else {
        setRows((prev) => prev.filter((x) => x.id !== row.id));
      }
    } finally {
      setBusy(false);
    }
  }

  const kindWord = (k: ResourceRow["kind"]) =>
    isAr ? RESOURCE_KIND_LABELS[k].arOne : RESOURCE_KIND_LABELS[k].enOne;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">{r.title}</h1>
          <p className="m-0 mt-1.5 max-w-[60ch] text-[0.875rem] text-[var(--color-subtle)]">
            {r.subtitle}
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn btn-primary shrink-0">
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
          {r.add}
        </button>
      </header>

      {notice && <Alert tone="info">{notice}</Alert>}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Armchair size={24} strokeWidth={1.7} />}
            title={r.emptyTitle}
            body={r.emptyBody}
            action={
              <button type="button" onClick={startCreate} className="btn btn-primary btn-sm">
                {r.add}
              </button>
            }
          />
        ) : (
          <Table minWidth="42rem">
            <THead>
              <TR>
                <TH>{r.name}</TH>
                <TH>{r.kind}</TH>
                <TH>{r.capacity}</TH>
                <TH>{r.area}</TH>
                {branches.length > 0 && <TH>{r.branch}</TH>}
                <TH>{r.status}</TH>
                <TH>
                  <span className="sr-only">{r.actions}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className={cn(!row.isActive && "opacity-55")}>
                  <TD>
                    <span className="font-bold text-[var(--color-ink)]">{row.name}</span>
                  </TD>
                  <TD>{kindWord(row.kind)}</TD>
                  <TD>
                    {row.capacity === null ? (
                      <span className="text-[var(--color-subtle)]">—</span>
                    ) : (
                      <span className="num">{num(row.capacity, lang)}</span>
                    )}
                  </TD>
                  <TD>{row.area || <span className="text-[var(--color-subtle)]">—</span>}</TD>
                  {branches.length > 0 && (
                    <TD>{row.branch?.nameAr || <span className="text-[var(--color-subtle)]">—</span>}</TD>
                  )}
                  <TD>
                    <span className={cn("badge", row.isActive ? "badge-success" : "badge-default")}>
                      {row.isActive ? r.active : r.inactive}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={`${r.edit} ${row.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                      >
                        <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        disabled={busy}
                        aria-label={`${r.remove} ${row.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                      >
                        <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        variant="sheet"
        title={editing ? r.editTitle : r.addTitle}
        footer={
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={close} className="flex-1">
              {r.cancel}
            </Button>
            <Button type="submit" form="resource-form" variant="primary" isLoading={busy} className="flex-[2]">
              {r.save}
            </Button>
          </div>
        }
      >
        <form id="resource-form" onSubmit={save} className="flex flex-col gap-4">
          <Input
            label={r.name}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={r.namePlaceholder}
            required
          />

          <Select
            label={r.kind}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as ResourceRow["kind"] })}
            hint={r.kindHint}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {isAr ? RESOURCE_KIND_LABELS[k].arOne : RESOURCE_KIND_LABELS[k].enOne}
              </option>
            ))}
          </Select>

          <Input
            label={r.capacity}
            type="number"
            inputMode="numeric"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            hint={r.capacityHint}
          />

          <Input
            label={r.area}
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder={r.areaPlaceholder}
          />

          {branches.length > 0 && (
            <Select
              label={r.branch}
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="">{r.anyBranch}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </Select>
          )}

          <Textarea
            label={r.notes}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
          />

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-jade)]"
            />
            <span className="text-[0.875rem] text-[var(--color-ink)]">{r.activeLabel}</span>
          </label>

          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      </Modal>
    </div>
  );
}
