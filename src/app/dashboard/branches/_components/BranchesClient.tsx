"use client";

import { useState } from "react";
import { countText } from "@/lib/i18n";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import LocationField from "@/components/shared/LocationField";
import type { LatLng } from "@/lib/geo";

export interface BranchRow {
  id: string;
  nameAr: string;
  nameEn: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isActive: boolean;
  _count: { bookings: number; resources: number };
}

/**
 * Locations.
 *
 * A business with one place never needs this page — the booking flow
 * skips the branch step until a second one exists.
 */
export default function BranchesClient({ initial }: { initial: BranchRow[] }) {
  const { t, lang } = useLanguage();
  const b = t.branches;

  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<{
    nameAr: string;
    nameEn: string;
    address: string;
    phone: string;
    isActive: boolean;
    location: LatLng | null;
  }>({
    nameAr: "",
    nameEn: "",
    address: "",
    phone: "",
    isActive: true,
    location: null,
  });

  function startCreate() {
    setForm({ nameAr: "", nameEn: "", address: "", phone: "", isActive: true, location: null });
    setError(null);
    setCreating(true);
  }

  function startEdit(row: BranchRow) {
    setForm({
      nameAr: row.nameAr,
      nameEn: row.nameEn ?? "",
      address: row.address ?? "",
      phone: row.phone ?? "",
      isActive: row.isActive,
      location: row.latitude !== null && row.longitude !== null ? { lat: row.latitude, lng: row.longitude } : null,
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
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      isActive: form.isActive,
      latitude: form.location?.lat ?? null,
      longitude: form.location?.lng ?? null,
    };

    try {
      const res = await fetch(
        editing ? `/api/business/branches/${editing.id}` : "/api/business/branches",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? b.saveError);
        return;
      }
      setRows((prev) =>
        editing
          ? prev.map((x) => (x.id === editing.id ? data.branch : x))
          : [...prev, data.branch],
      );
      close();
    } catch {
      setError(b.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BranchRow) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/business/branches/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return;
      if (data.deactivated) {
        setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, isActive: false } : x)));
        setNotice(countText(lang, data.bookings, b.deactivated));
      } else {
        setRows((prev) => prev.filter((x) => x.id !== row.id));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">{b.title}</h1>
          <p className="m-0 mt-1.5 max-w-[60ch] text-[0.875rem] text-[var(--color-subtle)]">
            {b.subtitle}
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn btn-primary shrink-0">
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
          {b.add}
        </button>
      </header>

      {notice && <Alert tone="info">{notice}</Alert>}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} strokeWidth={1.7} />}
            title={b.emptyTitle}
            body={b.emptyBody}
            action={
              <button type="button" onClick={startCreate} className="btn btn-primary btn-sm">
                {b.add}
              </button>
            }
          />
        ) : (
          <Table minWidth="40rem">
            <THead>
              <TR>
                <TH>{b.name}</TH>
                <TH>{b.address}</TH>
                <TH>{b.phone}</TH>
                <TH>{b.resources}</TH>
                <TH>{b.status}</TH>
                <TH>
                  <span className="sr-only">{b.actions}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className={cn(!row.isActive && "opacity-55")}>
                  <TD>
                    <span className="font-bold text-[var(--color-ink)]">{row.nameAr}</span>
                  </TD>
                  <TD>{row.address || <span className="text-[var(--color-subtle)]">—</span>}</TD>
                  <TD>
                    {row.phone ? (
                      <span className="num" dir="ltr">
                        {row.phone}
                      </span>
                    ) : (
                      <span className="text-[var(--color-subtle)]">—</span>
                    )}
                  </TD>
                  <TD>
                    <span className="num">{num(row._count.resources, lang)}</span>
                  </TD>
                  <TD>
                    <span className={cn("badge", row.isActive ? "badge-success" : "badge-default")}>
                      {row.isActive ? b.active : b.inactive}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={b.edit}
                        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                      >
                        <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        disabled={busy}
                        aria-label={b.remove}
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
        open={creating || editing !== null}
        onClose={close}
        variant="sheet"
        title={editing ? b.editTitle : b.addTitle}
        footer={
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={close} className="flex-1">
              {b.cancel}
            </Button>
            <Button
              type="submit"
              form="branch-form"
              variant="primary"
              isLoading={busy}
              className="flex-[2]"
            >
              {b.save}
            </Button>
          </div>
        }
      >
        <form id="branch-form" onSubmit={save} className="flex flex-col gap-4">
          <Input
            label={b.name}
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            placeholder={b.namePlaceholder}
            required
          />
          <Input
            label={b.nameEnLabel}
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
          <Input
            label={b.address}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="space-y-1.5">
            <p className="m-0 text-[0.8125rem] font-semibold text-[var(--color-ink-2)]">
              {lang === "ar" ? "الموقع على الخريطة (اختياري)" : "Location on the map (optional)"}
            </p>
            <LocationField value={form.location} onChange={(location) => setForm({ ...form, location })} />
          </div>
          <Input
            label={b.phone}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-jade)]"
            />
            <span className="text-[0.875rem] text-[var(--color-ink)]">{b.activeLabel}</span>
          </label>

          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      </Modal>
    </div>
  );
}
