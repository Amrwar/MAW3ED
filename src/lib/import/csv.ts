/**
 * Importing customers and services from a spreadsheet.
 *
 * Pure: parsing, header matching, validation and duplicate detection
 * all happen here without a database, so every rule is tested. The API
 * (api/business/import) supplies what already exists and writes what
 * this says is new. The preview and the commit run the same function on
 * the same file, so what the owner was shown is what gets written.
 *
 * A spreadsheet exported from Excel, Google Sheets or a phone arrives
 * with a byte-order mark, CRLF line endings, quoted cells with commas
 * and doubled quotes inside, and headers in Arabic or English; all of
 * that is accepted. Anything that would make a bad record is refused
 * row by row with the line number, never silently fixed.
 */

import { normalisePhone } from "@/lib/phone";

export type ImportKindName = "CUSTOMERS" | "SERVICES";

/** Bigger than any real customer list we expect; anything more is a payload. */
export const MAX_ROWS = 2000;
export const MAX_BYTES = 1024 * 1024;

export interface RowError {
  /** The spreadsheet's own line number (header = 1). */
  line: number;
  message: string;
  messageEn: string;
}

export interface CustomerRow {
  line: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

export interface ServiceRow {
  line: number;
  nameAr: string;
  nameEn: string | null;
  duration: number;
  price: number;
}

export interface Duplicate {
  line: number;
  /** "file": repeated earlier in this file; "existing": already in the business. */
  where: "file" | "existing";
  value: string;
}

export interface ImportPlan<Row> {
  rows: Row[];
  errors: RowError[];
  duplicates: Duplicate[];
  /** Data rows in the file, excluding the header and blank lines. */
  total: number;
}

/* ─── CSV ─────────────────────────────────────────────────── */

/** RFC 4180, forgivingly: quotes, doubled quotes, CRLF or LF, a BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Excel in an Arabic locale saves with semicolons; detect from the header line.
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ─── Headers ─────────────────────────────────────────────── */

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, "");

const CUSTOMER_HEADERS: Record<keyof Omit<CustomerRow, "line">, string[]> = {
  name: ["name", "fullname", "customer", "customername", "الاسم", "اسم", "اسمالعميل", "العميل"],
  phone: ["phone", "mobile", "phonenumber", "tel", "whatsapp", "الموبايل", "التليفون", "الهاتف", "رقمالموبايل", "رقمالهاتف", "موبايل", "واتساب"],
  email: ["email", "e-mail", "mail", "الإيميل", "الايميل", "البريد", "البريدالإلكتروني"],
  notes: ["notes", "note", "comments", "ملاحظات", "ملاحظة"],
};

const SERVICE_HEADERS: Record<keyof Omit<ServiceRow, "line">, string[]> = {
  nameAr: ["namear", "name", "service", "servicename", "الخدمة", "اسمالخدمة", "الاسم"],
  nameEn: ["nameen", "englishname", "الاسمبالإنجليزي", "الاسمبالانجليزي"],
  duration: ["duration", "minutes", "durationminutes", "mins", "المدة", "المدةبالدقائق", "المدةبالدقايق", "الدقائق"],
  price: ["price", "cost", "priceegp", "السعر", "سعر"],
};

function mapHeaders<K extends string>(header: string[], spec: Record<K, string[]>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const key of Object.keys(spec) as K[]) {
      if (out[key] === undefined && spec[key].map(norm).includes(n)) out[key] = i;
    }
  });
  return out;
}

/** Western digits for Arabic-Indic ones, so "٣٠" is 30. */
function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─── Planning ────────────────────────────────────────────── */

function preamble(text: string) {
  const errors: RowError[] = [];
  if (text.length > MAX_BYTES) {
    errors.push({ line: 0, message: "الملف أكبر من ١ ميجا", messageEn: "The file is larger than 1 MB" });
    return { header: [] as string[], body: [] as { line: number; cells: string[] }[], errors };
  }
  const all = parseCsv(text);
  const header = all[0] ?? [];
  const body = all
    .slice(1)
    .map((cells, i) => ({ line: i + 2, cells }))
    .filter((r) => r.cells.some((c) => c.trim() !== ""));
  if (body.length > MAX_ROWS) {
    errors.push({ line: 0, message: `الملف فيه أكتر من ${MAX_ROWS} صف`, messageEn: `The file has more than ${MAX_ROWS} rows` });
  }
  return { header, body: body.length > MAX_ROWS ? [] : body, errors };
}

/**
 * A row with more filled cells than the header has columns: almost
 * always a value with an unquoted comma — "1,250" read as 1 and 250.
 * Refused rather than guessed, because the guess is a wrong price.
 */
function overflow(cells: string[], header: string[]): boolean {
  return cells.slice(header.length).some((c) => c.trim() !== "");
}

const OVERFLOW: Omit<RowError, "line"> = {
  message: "الصف فيه خانات أكتر من العناوين — لو في قيمة فيها فاصلة حطها بين علامتين \"",
  messageEn: "This row has more cells than the header — put any value containing a comma in double quotes",
};

/**
 * Customers to create. `existingPhones` is the business's customers'
 * phones, normalised — a number already there is a duplicate however
 * it was typed.
 */
export function planCustomers(text: string, existingPhones: Set<string>): ImportPlan<CustomerRow> {
  const { header, body, errors } = preamble(text);
  const plan: ImportPlan<CustomerRow> = { rows: [], errors, duplicates: [], total: body.length };
  if (errors.length) return plan;
  const col = mapHeaders(header, CUSTOMER_HEADERS);
  if (col.name === undefined || col.phone === undefined) {
    plan.errors.push({
      line: 1,
      message: "لازم الملف يكون فيه عمود للاسم وعمود للموبايل",
      messageEn: "The file needs a name column and a phone column",
    });
    return plan;
  }
  const seen = new Set<string>();
  for (const { line, cells } of body) {
    const get = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());
    if (overflow(cells, header)) {
      plan.errors.push({ line, ...OVERFLOW });
      continue;
    }
    const name = get(col.name);
    const phoneRaw = westernDigits(get(col.phone));
    const email = get(col.email) || null;
    const notes = get(col.notes) || null;
    if (!name) {
      plan.errors.push({ line, message: "الاسم فاضي", messageEn: "Name is empty" });
      continue;
    }
    if (name.length > 120) {
      plan.errors.push({ line, message: "الاسم أطول من ١٢٠ حرف", messageEn: "Name is longer than 120 characters" });
      continue;
    }
    const e164 = normalisePhone(phoneRaw);
    if (!e164) {
      plan.errors.push({ line, message: "رقم الموبايل غير صحيح", messageEn: "Phone number is not valid" });
      continue;
    }
    if (email && !EMAIL.test(email)) {
      plan.errors.push({ line, message: "الإيميل غير صحيح", messageEn: "Email is not valid" });
      continue;
    }
    if (existingPhones.has(e164)) {
      plan.duplicates.push({ line, where: "existing", value: phoneRaw });
      continue;
    }
    if (seen.has(e164)) {
      plan.duplicates.push({ line, where: "file", value: phoneRaw });
      continue;
    }
    seen.add(e164);
    plan.rows.push({ line, name, phone: phoneRaw, email, notes: notes ? notes.slice(0, 2000) : null });
  }
  return plan;
}

/**
 * Services to create. `existingNames` is the business's service names,
 * lower-cased and trimmed.
 */
export function planServices(text: string, existingNames: Set<string>): ImportPlan<ServiceRow> {
  const { header, body, errors } = preamble(text);
  const plan: ImportPlan<ServiceRow> = { rows: [], errors, duplicates: [], total: body.length };
  if (errors.length) return plan;
  const col = mapHeaders(header, SERVICE_HEADERS);
  if (col.nameAr === undefined || col.duration === undefined || col.price === undefined) {
    plan.errors.push({
      line: 1,
      message: "لازم الملف يكون فيه أعمدة: الخدمة، المدة، السعر",
      messageEn: "The file needs service, duration and price columns",
    });
    return plan;
  }
  const seen = new Set<string>();
  for (const { line, cells } of body) {
    const get = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());
    if (overflow(cells, header)) {
      plan.errors.push({ line, ...OVERFLOW });
      continue;
    }
    const nameAr = get(col.nameAr);
    const nameEn = get(col.nameEn) || null;
    const durationRaw = westernDigits(get(col.duration));
    const priceRaw = westernDigits(get(col.price)).replace(/,/g, "");
    if (!nameAr) {
      plan.errors.push({ line, message: "اسم الخدمة فاضي", messageEn: "Service name is empty" });
      continue;
    }
    if (nameAr.length > 120) {
      plan.errors.push({ line, message: "اسم الخدمة أطول من ١٢٠ حرف", messageEn: "Service name is longer than 120 characters" });
      continue;
    }
    const duration = Number(durationRaw);
    if (!/^\d+$/.test(durationRaw) || duration < 5 || duration > 720) {
      plan.errors.push({ line, message: "المدة لازم تكون رقم صحيح من ٥ لـ ٧٢٠ دقيقة", messageEn: "Duration must be a whole number of minutes from 5 to 720" });
      continue;
    }
    const price = Number(priceRaw);
    if (!/^\d+(\.\d{1,2})?$/.test(priceRaw) || price > 1_000_000) {
      plan.errors.push({ line, message: "السعر لازم يكون رقم موجب (لحد قرشين عشري)", messageEn: "Price must be a non-negative number with at most two decimals" });
      continue;
    }
    const key = nameAr.toLowerCase();
    if (existingNames.has(key)) {
      plan.duplicates.push({ line, where: "existing", value: nameAr });
      continue;
    }
    if (seen.has(key)) {
      plan.duplicates.push({ line, where: "file", value: nameAr });
      continue;
    }
    seen.add(key);
    plan.rows.push({ line, nameAr, nameEn, duration, price });
  }
  return plan;
}

export const TEMPLATES: Record<ImportKindName, string> = {
  CUSTOMERS: "name,phone,email,notes\nعميل مثال,01000000000,,\n",
  SERVICES: "name,duration,price\nقص شعر,30,120\n",
};
