"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Download, Undo2, FileWarning } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { TEMPLATES, MAX_BYTES, type ImportKindName, type RowError, type Duplicate } from "@/lib/import/csv";

interface Preview {
  total: number;
  valid: number;
  errors: RowError[];
  duplicates: Duplicate[];
  preview: Record<string, unknown>[];
}

interface Batch {
  id: string;
  kind: ImportKindName;
  fileName: string | null;
  rowCount: number;
  skipped: number;
  createdAt: string;
  rolledBackAt: string | null;
  rolledBackCount: number | null;
}

export default function ImportClient() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const [kind, setKind] = useState<ImportKindName>("CUSTOMERS");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/business/import", { cache: "no-store" });
      if (res.ok) setBatches(((await res.json()) as { batches: Batch[] }).batches);
    } catch {}
  }, []);

  // The history, once on arrival. State is set only when the request
  // answers, and not at all if the page has gone by then.
  useEffect(() => {
    let live = true;
    fetch("/api/business/import", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ batches: Batch[] }>) : null))
      .then((json) => {
        if (live && json) setBatches(json.batches);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function send(mode: "preview" | "commit") {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/business/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, csv: file.text, fileName: file.name, mode }),
      });
      const json = (await res.json().catch(() => ({}))) as Preview & { error?: string; batch?: { rowCount: number } };
      if (!res.ok) {
        setMessage({ tone: "bad", text: json.error ?? (en ? "Import failed." : "الاستيراد فشل.") });
        return;
      }
      if (mode === "preview") {
        setPreview(json);
      } else {
        setMessage({
          tone: "ok",
          text: en
            ? `Imported ${json.batch?.rowCount ?? 0} record(s). You can undo this below.`
            : `اتستورد ${json.batch?.rowCount ?? 0} سجل. تقدر تتراجع من تحت.`,
        });
        setPreview(null);
        setFile(null);
        void loadBatches();
      }
    } catch {
      setMessage({ tone: "bad", text: en ? "Could not reach the server." : "مقدرناش نوصل للسيرفر." });
    } finally {
      setBusy(false);
    }
  }

  async function rollback(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/business/import/${id}/rollback`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { removed?: number; kept?: number; error?: string };
      if (!res.ok) {
        setMessage({ tone: "bad", text: json.error ?? (en ? "Could not undo." : "مقدرناش نتراجع.") });
      } else {
        setMessage({
          tone: "ok",
          text: en
            ? `Removed ${json.removed}. ${json.kept ? `${json.kept} kept because they already have bookings.` : ""}`
            : `اتمسح ${json.removed}. ${json.kept ? `و${json.kept} فضلوا عشان عندهم حجوزات.` : ""}`,
        });
      }
      void loadBatches();
    } finally {
      setBusy(false);
    }
  }

  async function pick(f: File | undefined) {
    setPreview(null);
    setMessage(null);
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) {
      setFile(null);
      setMessage({ tone: "bad", text: en ? "The file is larger than 1 MB." : "الملف أكبر من ١ ميجا." });
      return;
    }
    setFile({ name: f.name, text: await f.text() });
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATES[kind])}`;
  const kindLabel = (k: ImportKindName) =>
    k === "CUSTOMERS" ? (en ? "Customers" : "العملاء") : en ? "Services" : "الخدمات";

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-1">
        <h1 className="m-0 text-[1.625rem] font-black tracking-tight text-[var(--color-ink)]">
          {en ? "Import data" : "استيراد البيانات"}
        </h1>
        <p className="m-0 text-sm text-[var(--color-muted)]">
          {en
            ? "Bring your customer list or price list from a spreadsheet (CSV). You see a preview first; nothing is saved until you confirm, and every import can be undone."
            : "هات قايمة عملائك أو أسعارك من شيت (CSV). هتشوف معاينة الأول، ومفيش حاجة بتتحفظ غير لما تأكد، وأي استيراد تقدر تتراجع عنه."}
        </p>
        <Link href="/help/import" className="text-xs font-bold text-[var(--color-jade)] underline">
          {en ? "How to prepare the file" : "إزاي تجهّز الملف"}
        </Link>
      </header>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={en ? "What to import" : "هتستورد إيه"}>
          {(["CUSTOMERS", "SERVICES"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`btn btn-sm ${kind === k ? "btn-primary" : "btn-outline"}`}
              onClick={() => {
                setKind(k);
                setPreview(null);
              }}
            >
              {kindLabel(k)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-outline gap-2">
            <Upload size={16} aria-hidden="true" />
            {file ? file.name : en ? "Choose a CSV file" : "اختار ملف CSV"}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <a href={templateHref} download={kind === "CUSTOMERS" ? "customers-template.csv" : "services-template.csv"} className="btn btn-ghost gap-2">
            <Download size={16} aria-hidden="true" />
            {en ? "Download template" : "نزّل نموذج"}
          </a>
          <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => send("preview")}>
            {en ? "Preview" : "معاينة"}
          </button>
        </div>

        {preview && (
          <div className="space-y-3">
            <p className="m-0 text-sm">
              {en
                ? `${preview.total} row(s): ${preview.valid} ready, ${preview.duplicates.length} duplicate(s) skipped, ${preview.errors.length} with errors.`
                : `${preview.total} صف: ${preview.valid} جاهزين، ${preview.duplicates.length} مكرر هيتساب، ${preview.errors.length} فيهم أخطاء.`}
            </p>

            {preview.errors.length > 0 && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] p-3">
                <p className="m-0 mb-1 flex items-center gap-2 text-sm font-bold text-[var(--color-warn)]">
                  <FileWarning size={16} aria-hidden="true" />
                  {en ? "Rows that will not be imported" : "صفوف مش هتتستورد"}
                </p>
                <ul className="m-0 max-h-48 list-none space-y-0.5 overflow-auto p-0 text-xs text-[var(--color-warn)]">
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      {e.line > 0 ? (en ? `Line ${e.line}: ` : `سطر ${e.line}: `) : ""}
                      {en ? e.messageEn : e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.duplicates.length > 0 && (
              <ul className="m-0 max-h-32 list-none space-y-0.5 overflow-auto p-0 text-xs text-[var(--color-subtle)]">
                {preview.duplicates.map((d, i) => (
                  <li key={i}>
                    {en ? `Line ${d.line}: ` : `سطر ${d.line}: `}
                    <span dir="auto">{d.value}</span> —{" "}
                    {d.where === "existing"
                      ? en ? "already in your list" : "موجود عندك"
                      : en ? "repeated in this file" : "متكرر في الملف"}
                  </li>
                ))}
              </ul>
            )}

            {preview.preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr>
                      {Object.keys(preview.preview[0]).map((h) => (
                        <th key={h} className="border-b border-[var(--color-line)] p-2 text-start">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((r, i) => (
                      <tr key={i}>
                        {Object.values(r).map((v, j) => (
                          <td key={j} className="border-b border-[var(--color-line)] p-2" dir="auto">{v == null ? "" : String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button type="button" className="btn btn-primary" disabled={busy || preview.valid === 0} onClick={() => send("commit")}>
              {en ? `Import ${preview.valid} record(s)` : `استورد ${preview.valid} سجل`}
            </button>
          </div>
        )}

        <p role="status" className={`m-0 min-h-5 text-sm ${message?.tone === "ok" ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>
          {message?.text}
        </p>
      </section>

      <section className="card p-5 space-y-3" aria-labelledby="hist-h">
        <h2 id="hist-h" className="m-0 text-base font-extrabold">{en ? "Past imports" : "استيرادات سابقة"}</h2>
        {batches.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{en ? "Nothing imported yet." : "لسه مفيش استيراد."}</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-line)] p-0">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="m-0 font-bold">
                    {kindLabel(b.kind)} · <span dir="auto">{b.fileName ?? "—"}</span>
                  </p>
                  <p className="m-0 text-xs text-[var(--color-subtle)]">
                    {new Date(b.createdAt).toLocaleString(en ? "en-GB" : "ar-EG-u-nu-latn", { timeZone: "Africa/Cairo" })} ·{" "}
                    {en ? `${b.rowCount} added, ${b.skipped} skipped` : `${b.rowCount} اتضافوا، ${b.skipped} اتسابوا`}
                    {b.rolledBackAt ? (en ? ` · undone (${b.rolledBackCount} removed)` : ` · اتلغى (${b.rolledBackCount} اتمسحوا)`) : ""}
                  </p>
                </div>
                {!b.rolledBackAt && (
                  <button type="button" className="btn btn-sm btn-ghost gap-1" disabled={busy} onClick={() => rollback(b.id)}>
                    <Undo2 size={14} aria-hidden="true" />
                    {en ? "Undo" : "تراجع"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
