import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Keeps the environment audit from going stale the day after it is
 * done.
 *
 * An undeclared variable is not a crash. It is `process.env.THING ??
 * fallback` quietly taking the fallback forever, on a deployment where
 * somebody believed they had configured it. The audit that produced
 * this test found an entire SMS integration read in three places,
 * declared nowhere and documented nowhere — dormant by design, but
 * nothing said so outside one comment.
 *
 * So: every variable the code reads must be declared in env.ts, which
 * is where its type and optionality live, and documented in
 * .env.example, which is what somebody copies when setting the project
 * up. Variables the platform provides are exempt and listed below.
 */

const ROOT = process.cwd();

/**
 * Supplied by the runtime or the CI provider, never by a person, so
 * they belong in neither file.
 */
const PLATFORM_PROVIDED = new Set([
  "NODE_ENV",
  "NEXT_RUNTIME",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_GIT_COMMIT_SHA",
  "CI",
]);

/**
 * Written by next.config.ts at build time, not by a person.
 *
 * Putting these in .env.example would invite somebody to set them by
 * hand, which would be worse than leaving them out: the app would then
 * report a version that does not match the code it is running.
 */
const BUILD_INJECTED = new Set(["NEXT_PUBLIC_APP_VERSION", "NEXT_PUBLIC_COMMIT_SHA"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "mobile", "dist", "build"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Every `process.env.NAME` in the codebase, and where it was read. */
function variablesRead(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(ROOT)) {
    const source = readFileSync(file, "utf8");
    // Strip comments first: env.ts explains itself using
    // `process.env.X ?? "some-fallback"`, and X is not a variable.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const [, name] of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      if (PLATFORM_PROVIDED.has(name) || BUILD_INJECTED.has(name)) continue;
      const where = relative(ROOT, file).replace(/\\/g, "/");
      const list = found.get(name) ?? [];
      if (!list.includes(where)) list.push(where);
      found.set(name, list);
    }
  }
  return found;
}

const declared = new Set(
  // The `\s*` after the z is there because a longer schema wraps onto
  // the next line, as DATABASE_URL's does.
  [...readFileSync(join(ROOT, "src/lib/env.ts"), "utf8").matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*z\s*\./gm)]
    .map((m) => m[1]),
);

/**
 * Read explicitly, so a missing template says what is wrong.
 *
 * This file is the one somebody copies to .env. It was matched by
 * `.env*` in .gitignore and had never been committed, so this suite
 * died with a bare ENOENT on a fresh checkout while every other test
 * passed. The .gitignore is fixed; this keeps the next version of that
 * mistake legible.
 */
function readEnvExample(): string {
  const path = join(ROOT, ".env.example");
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(
      ".env.example is missing. It is the template this project is set up from, " +
        "and it must be committed — check that .gitignore's `.env*` rule still has " +
        "the `!.env.example` exception below it.",
    );
  }
}

const documented = new Set(
  [...readEnvExample().matchAll(/^([A-Z][A-Z0-9_]+)=/gm)]
    .map((m) => m[1]),
);

describe("the environment", () => {
  it("reads a plausible number of variables", () => {
    // Guards the two tests below from passing because the scan broke
    // and found nothing.
    expect(variablesRead().size).toBeGreaterThan(20);
  });

  it("declares every variable the code reads", () => {
    const missing = [...variablesRead()]
      .filter(([name]) => !declared.has(name))
      .map(([name, files]) => `${name} (read in ${files[0]})`);
    expect(missing).toEqual([]);
  });

  it("documents every variable the code reads", () => {
    // .env.example is what somebody copies. A variable missing from it
    // is one they will not know to set.
    const missing = [...variablesRead()]
      .filter(([name]) => !documented.has(name))
      .map(([name, files]) => `${name} (read in ${files[0]})`);
    expect(missing).toEqual([]);
  });

  it("documents nothing the code never reads", () => {
    // The other direction: a leftover in .env.example is somebody
    // setting a variable that does nothing, and believing it does.
    const unused = [...documented].filter(
      (name) => !variablesRead().has(name) && !PLATFORM_PROVIDED.has(name),
    );
    expect(unused).toEqual([]);
  });

  it("keeps no secret behind a NEXT_PUBLIC_ name", () => {
    // NEXT_PUBLIC_ variables are inlined into the browser bundle. A
    // secret with that prefix is published, not configured.
    const suspicious = [...documented].filter(
      (name) =>
        name.startsWith("NEXT_PUBLIC_") &&
        /SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY/.test(name),
    );
    expect(suspicious).toEqual([]);
  });
});
