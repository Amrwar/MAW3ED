"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Power, Tag, Ticket, Trash2 } from "lucide-react";
import type { DiscountKind } from "@prisma/client";
import Alert from "@/components/ui/Alert";
import { formatCents } from "@/lib/payments/money";
import { cn } from "@/lib/utils";

export interface OfferRow {
  id: string;
  code: string | null;
  nameAr: string;
  kind: DiscountKind;
  value: number;
  minSpendCents: number | null;
  maxDiscountCents: number | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  serviceIds: string[];
  usedCount: number;
  givenAwayCents: number;
}

/**
 * What a business is offering, and a form to add another.
 *
 * The one decision the form makes for the owner is the meaning of the
 * code field: fill it in and customers have to type it; leave it empty
 * and the offer applies by itself. That is said in words above the
 * field rather than being a toggle, because it is the same thing from
 * the customer's side either way.
 */
export default function OffersClient({
  rows,
  services,
}: {
  rows: OfferRow[];
  services: { id: string; nameAr: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nameAr: "",
    code: "",
    kind: "PERCENT" as DiscountKind,
    value: "",
    minSpend: "",
    maxDiscount: "",
    maxRedemptions: "",
    perCustomerLimit: "",
    endsAt: "",
    serviceIds: [] as string[],
  });

  const toCents = (pounds: string) =>
    pounds.trim() ? Math.round(Number(pounds) * 100) : null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/business/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr: form.nameAr.trim(),
          code: form.code.trim() || null,
          kind: form.kind,
          value: Number(form.value),
          minSpendCents: toCents(form.minSpend),
          maxDiscountCents: form.kind === "PERCENT" ? toCents(form.maxDiscount) : null,
          maxRedemptions: form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null,
          perCustomerLimit: form.perCustomerLimit.trim() ? Number(form.perCustomerLimit) : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          serviceIds: form.serviceIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "تعذّر إنشاء العرض");
        return;
      }
      setOpen(false);
      setForm({
        nameAr: "", code: "", kind: "PERCENT", value: "", minSpend: "",
        maxDiscount: "", maxRedemptions: "", perCustomerLimit: "", endsAt: "", serviceIds: [],
      });
      router.refresh();
    } catch {
      setError("تعذّر الاتصال");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(row: OfferRow) {
    setBusy(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/business/discounts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر التغيير");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: OfferRow) {
    setBusy(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/business/discounts/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر الحذف");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function describe(row: OfferRow): string {
    const off =
      row.kind === "PERCENT"
        ? `${row.value}%`
        : formatCents(row.value);
    const bits = [off];
    if (row.maxDiscountCents) bits.push(`بحد أقصى ${formatCents(row.maxDiscountCents)}`);
    if (row.minSpendCents) bits.push(`لحجوزات من ${formatCents(row.minSpendCents)}`);
    if (row.serviceIds.length > 0) bits.push(`${row.serviceIds.length} خدمة`);
    if (row.maxRedemptions) bits.push(`${row.redemptionCount}/${row.maxRedemptions} استخدام`);
    if (row.perCustomerLimit) bits.push(`${row.perCustomerLimit} لكل عميل`);
    return bits.join(" · ");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[1.375rem] font-bold text-[var(--color-ink)]">العروض والأكواد</h1>
          <p className="m-0 mt-1.5 max-w-[60ch] text-[0.875rem] leading-relaxed text-[var(--color-subtle)]">
            عرض بكود العميل بيكتبه، وعرض من غير كود بيتطبّق لوحده على أي حجز مطابق.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary btn-sm">
          <Plus size={14} aria-hidden="true" />
          عرض جديد
        </button>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      {open && (
        <form onSubmit={create} className="card space-y-3 p-5">
          <Field label="اسم العرض" htmlFor="o-name">
            <input
              id="o-name"
              required
              minLength={2}
              maxLength={120}
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              placeholder="عرض العيد"
              className={INPUT}
            />
          </Field>

          <Field
            label="الكود"
            htmlFor="o-code"
            hint="سيبه فاضي عشان العرض يتطبّق لوحده من غير ما العميل يكتب حاجة"
          >
            <input
              id="o-code"
              dir="ltr"
              maxLength={40}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EID20"
              className={INPUT}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="النوع" htmlFor="o-kind">
              <select
                id="o-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as DiscountKind })}
                className={INPUT}
              >
                <option value="PERCENT">نسبة %</option>
                <option value="FIXED">مبلغ ثابت</option>
              </select>
            </Field>
            <Field label={form.kind === "PERCENT" ? "النسبة" : "المبلغ بالجنيه"} htmlFor="o-value">
              <input
                id="o-value"
                type="number"
                required
                min={1}
                max={form.kind === "PERCENT" ? 100 : undefined}
                step={form.kind === "PERCENT" ? 1 : 0.01}
                dir="ltr"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="أقل قيمة حجز (جنيه)" htmlFor="o-min" hint="اختياري">
              <input id="o-min" type="number" min={0} step={0.01} dir="ltr"
                value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
                className={INPUT} />
            </Field>
            {form.kind === "PERCENT" && (
              <Field label="أقصى خصم (جنيه)" htmlFor="o-max" hint="يحمي العرض من الخدمات الغالية">
                <input id="o-max" type="number" min={0} step={0.01} dir="ltr"
                  value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  className={INPUT} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="عدد مرات الاستخدام" htmlFor="o-uses" hint="اختياري">
              <input id="o-uses" type="number" min={1} dir="ltr"
                value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                className={INPUT} />
            </Field>
            <Field label="لكل عميل" htmlFor="o-per" hint="اختياري">
              <input id="o-per" type="number" min={1} dir="ltr"
                value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
                className={INPUT} />
            </Field>
          </div>

          <Field label="ينتهي في" htmlFor="o-ends" hint="اختياري">
            <input id="o-ends" type="date" dir="ltr" value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={INPUT} />
          </Field>

          {services.length > 0 && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-1.5 p-0 text-xs font-semibold text-[var(--color-subtle)]">
                الخدمات — سيبها كلها فاضية عشان العرض يشمل كل الخدمات
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => {
                  const on = form.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setForm({
                          ...form,
                          serviceIds: on
                            ? form.serviceIds.filter((x) => x !== s.id)
                            : [...form.serviceIds, s.id],
                        })
                      }
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-[0.78125rem] transition-colors",
                        on
                          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)]",
                      )}
                    >
                      {s.nameAr}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy === "create"} className="btn btn-primary btn-sm">
              {busy === "create" && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              احفظ
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-[0.875rem] text-[var(--color-subtle)]">
          لسه مفيش عروض.
        </div>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {rows.map((row) => (
            <li key={row.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-ink)]">
                    {row.code ? (
                      <Ticket size={14} aria-hidden="true" className="text-[var(--color-jade)]" />
                    ) : (
                      <Tag size={14} aria-hidden="true" className="text-[var(--color-jade)]" />
                    )}
                    {row.nameAr}
                    {row.code && (
                      <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[0.75rem]" dir="ltr">
                        {row.code}
                      </code>
                    )}
                    {!row.isActive && (
                      <span className="text-[0.6875rem] font-normal text-[var(--color-faint)]">موقوف</span>
                    )}
                  </p>
                  <p className="num m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                    {describe(row)}
                  </p>
                  <p className="num m-0 mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">
                    {row.code ? "العميل بيكتبه" : "بيتطبّق لوحده"}
                    {" · "}
                    اتستخدم {row.usedCount} مرة
                    {row.givenAwayCents > 0 && ` · وفّر للعملاء ${formatCents(row.givenAwayCents)}`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggle(row)}
                    disabled={busy === row.id}
                    className="btn btn-outline btn-sm"
                  >
                    <Power size={12} aria-hidden="true" />
                    {row.isActive ? "وقّف" : "شغّل"}
                  </button>
                  {row.usedCount === 0 && (
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      disabled={busy === row.id}
                      aria-label={`امسح ${row.nameAr}`}
                      className="btn btn-ghost btn-sm text-[var(--color-danger)]"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[0.84375rem] outline-none focus:border-[var(--color-jade)]";

function Field({
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
      {hint && <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-faint)]">{hint}</p>}
    </div>
  );
}
