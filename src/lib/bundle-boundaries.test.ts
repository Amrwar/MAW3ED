import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Keeps the database out of the browser.
 *
 * This guards a mistake that is invisible in review and silent at
 * build time. A client component imports one harmless-looking value —
 * a list of sort options, a table of labels — from a module that also
 * imports `db`. TypeScript is happy, the page works, and the bundler
 * quietly includes PrismaClient, which carries the generated metadata
 * for every model and column in the schema.
 *
 * It had happened three times when this was written: REVIEW_SORTS on
 * the public profile (213 KB raw, 68 KB over the wire, on a page where
 * somebody is reading a barbershop's opening hours), and layoutDay and
 * RESOURCE_KIND_LABELS in the dashboard. Fixing the three cut the
 * public profile from 404 KB of JavaScript to 330 KB.
 *
 * The weight is the smaller half. The schema is a list of every table
 * and field in the database, and serving it to anyone who opens
 * devtools is free reconnaissance.
 *
 * `import type` is fine and is what most of these components want:
 * TypeScript erases it, so nothing reaches the bundle. This test only
 * objects to importing a *value* across the line.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** "src/lib/reviews.ts" -> "@/lib/reviews", the form imports are written in. */
function moduleId(file: string): string {
  return "@/" + relative(SRC, file).replace(/\\/g, "/").replace(/\.tsx?$/, "");
}

interface Import {
  /** The module specifier. */
  from: string;
  /** True when nothing it brings in survives compilation. */
  typeOnly: boolean;
}

const IMPORT_RE = /import\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']/g;

function importsOf(source: string): Import[] {
  const out: Import[] = [];
  for (const [, typeKeyword, clause, from] of source.matchAll(IMPORT_RE)) {
    // `import type { X } from "y"` erases entirely. So does a named
    // list in which every member carries its own `type` modifier, as in
    // `import { type A, type B }`. A bare `{ A, type B }` does not.
    const names = clause.trim();
    const allInlineTypes =
      names.startsWith("{") &&
      names
        .slice(1, -1)
        .split(",")
        .filter((p) => p.trim())
        .every((p) => p.trim().startsWith("type "));
    out.push({ from, typeOnly: Boolean(typeKeyword) || allInlineTypes });
  }
  return out;
}

const files = walk(SRC);
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const byId = new Map(files.map((f) => [moduleId(f), f]));

/**
 * Every module from which a value import reaches the database, directly
 * or through another module. Resolved transitively, because the leak
 * travels: a pure-looking helper that value-imports a db module is
 * itself a db module as far as the bundler is concerned.
 */
function modulesReachingTheDatabase(): Set<string> {
  const tainted = new Set<string>();
  for (const [file, source] of sources) {
    if (importsOf(source).some((i) => i.from === "@/lib/db" && !i.typeOnly)) {
      tainted.add(moduleId(file));
    }
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const [file, source] of sources) {
      const id = moduleId(file);
      if (tainted.has(id)) continue;
      if (importsOf(source).some((i) => !i.typeOnly && tainted.has(i.from))) {
        tainted.add(id);
        changed = true;
      }
    }
  }
  return tainted;
}

describe("the client/server boundary", () => {
  it("finds the database modules at all", () => {
    // If this ever returns nothing, the test below passes for the wrong
    // reason and guards nothing.
    const tainted = modulesReachingTheDatabase();
    expect(tainted.size).toBeGreaterThan(10);
    expect(tainted).toContain("@/lib/reviews");
  });

  it("keeps the pure modules pure", () => {
    // These three exist only so a client component has somewhere safe
    // to import from. A `db` import appearing in one would undo the
    // split without breaking anything visible.
    const tainted = modulesReachingTheDatabase();
    for (const id of [
      "@/lib/review-sorts",
      "@/lib/scheduling/calendar-layout",
      "@/lib/scheduling/resource-labels",
    ]) {
      expect(byId.has(id), `${id} is missing`).toBe(true);
      expect(tainted.has(id), `${id} now reaches the database`).toBe(false);
    }
  });

  it("ships no database module to the browser", () => {
    const tainted = modulesReachingTheDatabase();
    const leaks: string[] = [];

    for (const [file, source] of sources) {
      if (!file.endsWith(".tsx")) continue;
      // The directive has to be the first statement to take effect.
      if (!/^\s*["']use client["']/.test(source)) continue;
      for (const imp of importsOf(source)) {
        if (imp.typeOnly) continue;
        if (!tainted.has(imp.from)) continue;
        leaks.push(`${relative(process.cwd(), file).replace(/\\/g, "/")} imports ${imp.from}`);
      }
    }

    // Named in the failure rather than counted, because the fix is
    // specific: move the value into a module that imports no database,
    // or make the import `import type`.
    expect(leaks).toEqual([]);
  });
});
