/**
 * Automatic English for what a business wrote only in Arabic.
 *
 * Owners often fill in only the Arabic name, tagline and services, and
 * the tagline and service descriptions have no English field at all, so
 * an English visitor read Arabic on half of every card. This fills the
 * gap with a machine translation kept in its own columns (*EnAuto):
 *
 *   - the owner's own English always wins; a translation is made only
 *     where there is none, and dropped once the owner writes one;
 *   - each translation records a fingerprint of the Arabic it came from
 *     (autoEnSource), so it is redone only when that text changes, and
 *     re-running costs nothing when nothing changed;
 *   - it never blocks or fails a save: callers run it after the
 *     response (next/server `after`), and the nightly cron fills
 *     anything a failed or skipped run left behind.
 *
 * The model is reached through Vercel AI Gateway: on Vercel the
 * deployment authenticates itself (OIDC), locally AI_GATEWAY_API_KEY.
 * With neither, translation is switched off and nothing else changes.
 */

import { createHash } from "node:crypto";
import { after } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { hasArabic } from "@/lib/lang";

/** Cheap, fast and plenty for short listing text. Overridable per deploy. */
const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

/** Long "about" texts are cut rather than sent whole. */
const MAX_SOURCE_CHARS = 4000;
/** Fields per model call; a business with more is finished by the cron. */
const MAX_FIELDS_PER_CALL = 60;

/** One Arabic test for the app (lib/lang), re-exported for callers here. */
export { hasArabic };

/** Short, stable fingerprint of a source text. */
export function fingerprint(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export function translationEnabled(
  // Read by name, so the environment audit (env-coverage.test) sees them.
  env: Record<string, string | undefined> = {
    AUTO_TRANSLATE: process.env.AUTO_TRANSLATE,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    VERCEL: process.env.VERCEL,
  },
): boolean {
  if (env.AUTO_TRANSLATE === "0") return false;
  return Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL);
}

/* ─── Planning: which fields need a (new) translation ─────────── */

export type FieldKind = "name" | "text";

export interface FieldState {
  /** Key within its record, e.g. "name", "tagline". */
  field: string;
  kind: FieldKind;
  /** The Arabic the owner wrote. */
  source: string | null | undefined;
  /** The owner's own English, when the field has one. */
  ownerEnglish?: string | null;
  /** The machine English stored now. */
  current: string | null | undefined;
}

export type Plan =
  | { action: "keep" }
  | { action: "clear" }
  | { action: "translate"; source: string; hash: string };

/** Stored instead of a fingerprint when the model gave nothing usable. */
const FAILED = "failed:";

/**
 * What to do with one field: translate it, drop its translation (the
 * owner wrote English, or removed the Arabic), or leave it.
 *
 * A text the model could not translate is marked, and not sent again on
 * every save; only the nightly run (`retryFailed`) tries it again, and a
 * change to the Arabic starts afresh.
 */
export function planField(f: FieldState, stored: Record<string, string>, retryFailed = false): Plan {
  const source = f.source?.trim() ?? "";
  if (f.ownerEnglish?.trim() || !source || !hasArabic(source)) {
    return f.current || stored[f.field] ? { action: "clear" } : { action: "keep" };
  }
  const hash = fingerprint(source);
  if (f.current && stored[f.field] === hash) return { action: "keep" };
  if (!retryFailed && stored[f.field] === FAILED + hash) return { action: "keep" };
  return { action: "translate", source: source.slice(0, MAX_SOURCE_CHARS), hash };
}

/* ─── The model call ──────────────────────────────────────────── */

const SYSTEM = `You translate text from an Egyptian online booking platform (clinics, salons, gyms, tutors and similar local businesses) from Arabic into natural English for English-speaking customers.

Rules:
- Items of kind "name" are business, service or person names. Transliterate personal and brand names the way they are usually written in Egypt (محمد → Mohamed, عطية → Attia) and translate only the descriptive words (عيادة → Clinic, للحلاقة → Barbershop, كشف → Consultation). Keep a brand name that is already in Latin letters exactly as written.
- Items of kind "text" are descriptions. Translate the meaning naturally, keep the same length and tone, keep numbers, prices and phone numbers exactly, and do not add or remove information.
- If an item mixes Arabic and English, keep the English parts and translate the rest.
- Return plain text only: no quotes, no notes, no explanations.`;

const OutputSchema = z.object({
  translations: z.array(z.object({ id: z.string(), english: z.string() })),
});

export interface TranslationItem {
  id: string;
  kind: FieldKind;
  source: string;
}

/** Translates a batch; returns id → English. Throws on model failure. */
export async function translateItems(items: TranslationItem[]): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const { output } = await generateText({
    model: process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL,
    system: SYSTEM,
    output: Output.object({ schema: OutputSchema }),
    prompt: `Translate each item. Return one entry per id.\n\n${JSON.stringify(
      items.map((i) => ({ id: i.id, kind: i.kind, arabic: i.source })),
    )}`,
    maxRetries: 2,
  });
  const wanted = new Set(items.map((i) => i.id));
  const out = new Map<string, string>();
  for (const t of output.translations) {
    const english = t.english.trim();
    // Only ids we asked for, and nothing that came back still Arabic.
    if (wanted.has(t.id) && english && !hasArabic(english)) out.set(t.id, english.slice(0, MAX_SOURCE_CHARS));
  }
  return out;
}

/* ─── Syncing a business and its services ─────────────────────── */

type Stored = Record<string, string>;
const asStored = (v: Prisma.JsonValue | null): Stored =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Stored) : {};

const BUSINESS_FIELDS = {
  name: "nameEnAuto",
  tagline: "taglineEnAuto",
  about: "aboutEnAuto",
} as const;
const SERVICE_FIELDS = {
  name: "nameEnAuto",
  description: "descriptionEnAuto",
} as const;

/**
 * Brings one business's machine English up to date with its Arabic.
 * Never throws: a failure is logged and the nightly cron tries again.
 * Returns how many fields were translated.
 */
export async function syncBusinessTranslations(
  businessId: string,
  opts: { retryFailed?: boolean } = {},
): Promise<number> {
  if (!translationEnabled()) return 0;
  try {
    const b = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        taglineAr: true,
        about: true,
        nameEnAuto: true,
        taglineEnAuto: true,
        aboutEnAuto: true,
        autoEnSource: true,
        services: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            descriptionAr: true,
            nameEnAuto: true,
            descriptionEnAuto: true,
            autoEnSource: true,
          },
          orderBy: { sortOrder: "asc" },
          take: 200,
        },
      },
    });
    if (!b) return 0;

    type Target = { table: "business" | "service"; id: string; field: string; column: string; hash?: string };
    const items: TranslationItem[] = [];
    const targets = new Map<string, Target>();
    const clears: Target[] = [];

    const consider = (table: Target["table"], id: string, column: string, state: FieldState, stored: Stored) => {
      const plan = planField(state, stored, opts.retryFailed);
      const target: Target = { table, id, field: state.field, column };
      if (plan.action === "clear") clears.push(target);
      if (plan.action === "translate" && items.length < MAX_FIELDS_PER_CALL) {
        const key = `${table}:${id}:${state.field}`;
        items.push({ id: key, kind: state.kind, source: plan.source });
        targets.set(key, { ...target, hash: plan.hash });
      }
    };

    const bStored = asStored(b.autoEnSource);
    consider("business", b.id, BUSINESS_FIELDS.name, { field: "name", kind: "name", source: b.nameAr, ownerEnglish: b.nameEn, current: b.nameEnAuto }, bStored);
    consider("business", b.id, BUSINESS_FIELDS.tagline, { field: "tagline", kind: "text", source: b.taglineAr, current: b.taglineEnAuto }, bStored);
    consider("business", b.id, BUSINESS_FIELDS.about, { field: "about", kind: "text", source: b.about, current: b.aboutEnAuto }, bStored);
    for (const s of b.services) {
      const sStored = asStored(s.autoEnSource);
      consider("service", s.id, SERVICE_FIELDS.name, { field: "name", kind: "name", source: s.nameAr, ownerEnglish: s.nameEn, current: s.nameEnAuto }, sStored);
      consider("service", s.id, SERVICE_FIELDS.description, { field: "description", kind: "text", source: s.descriptionAr, current: s.descriptionEnAuto }, sStored);
    }

    if (items.length === 0 && clears.length === 0) return 0;

    const translated = items.length ? await translateItems(items) : new Map<string, string>();

    // The Arabic may have changed while the model worked (another save
    // started its own sync). Write only what still matches the text as
    // it is now; the newer sync handles the rest.
    const now = await db.business.findUnique({
      where: { id: businessId },
      select: {
        nameAr: true, taglineAr: true, about: true,
        services: { select: { id: true, nameAr: true, descriptionAr: true } },
      },
    });
    if (!now) return 0;
    const currentSource = (t: Target): string => {
      if (t.table === "business") {
        return (t.field === "name" ? now.nameAr : t.field === "tagline" ? now.taglineAr : now.about)?.trim() ?? "";
      }
      const s = now.services.find((x) => x.id === t.id);
      return (t.field === "name" ? s?.nameAr : s?.descriptionAr)?.trim() ?? "";
    };
    const stillCurrent = (t: Target) => !!t.hash && fingerprint(currentSource(t)) === t.hash;

    // One update per record, merging its fingerprints.
    const updates = new Map<string, { table: Target["table"]; id: string; data: Record<string, string | null>; stored: Stored }>();
    const recordFor = (t: Target) => {
      const k = `${t.table}:${t.id}`;
      if (!updates.has(k)) {
        const stored =
          t.table === "business" ? { ...bStored } : { ...asStored(b.services.find((s) => s.id === t.id)?.autoEnSource ?? null) };
        updates.set(k, { table: t.table, id: t.id, data: {}, stored });
      }
      return updates.get(k)!;
    };
    for (const t of clears) {
      const r = recordFor(t);
      r.data[t.column] = null;
      delete r.stored[t.field];
    }
    let written = 0;
    for (const [key, t] of targets) {
      if (!stillCurrent(t)) continue;
      const english = translated.get(key);
      const r = recordFor(t);
      if (english) {
        r.data[t.column] = english;
        r.stored[t.field] = t.hash!;
        written++;
      } else {
        // Nothing usable came back: remember it, so a save does not ask again.
        r.stored[t.field] = FAILED + t.hash!;
      }
    }

    // Each record on its own: one that fails (say, a service deleted
    // meanwhile) does not throw away the others' translations.
    const results = await Promise.allSettled(
      [...updates.values()].map((r) => {
        const data = { ...r.data, autoEnSource: r.stored as Prisma.InputJsonValue };
        return r.table === "business"
          ? db.business.update({ where: { id: r.id }, data })
          : db.service.update({ where: { id: r.id }, data });
      }),
    );
    for (const res of results) {
      if (res.status === "rejected") log.error(`[translate] a write for business ${businessId} failed`, res.reason);
    }
    return written;
  } catch (e) {
    log.error(`[translate] business ${businessId} failed`, e);
    return 0;
  }
}

/**
 * After a save: translate once the response has gone, so the owner
 * never waits on the model. Outside a request (a script, a test) the
 * work just runs.
 */
export function translateAfterSave(businessId: string): void {
  if (!translationEnabled()) return;
  const run = async () => {
    await syncBusinessTranslations(businessId);
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/* ─── Reading: the English to show ─── */

export { englishOf } from "./english";
