import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/**
 * Every word of UI exists in both languages, and the right one shows.
 *
 * The app has no message catalogue for screen copy: each screen writes
 * its words next to the code that shows them, in one of these shapes —
 *
 *   T("عربي", "English")                 a local `const T = (a, e) => (ar ? a : e)`
 *   T(lang, "عربي", "English")           the same, outside a component
 *   ar ? "عربي" : "English"              or lang === "ar" ? … : …, or the reverse on "en"
 *   { ar: "عربي", en: "English" }        tables keyed by status, role, reason…
 *   ["عربي", "English"]                  [ar, en] tuples in a table
 *   const X = {…}; const X_EN = {…}      a table and its English twin
 *   if (lang === "en") return "…"; …     an English branch, Arabic after it
 *
 * plus the design system's dictionary (design/strings.ts) for the words
 * its components say themselves. This holds every source file to those
 * shapes: an Arabic string anywhere else is a word English mode cannot
 * translate, and an English word in JSX text or a label prop is one
 * Arabic mode shows untranslated. It also checks each pair is a pair —
 * an English side that is empty, a copy of the Arabic, or itself Arabic
 * is the same bug, hidden.
 *
 * Data the owners typed (business names, services, reviews) is not UI
 * and never appears here as a literal, so it is out of scope by nature.
 *
 * And dates, prices, durations and error messages: the helpers that take
 * the language last default it to Arabic. A call that leaves it off
 * prints "12 أكتوبر" in English mode; this fails on it.
 */

const ROOT = __dirname;
const SCANNED = ["app", "features", "design", "lib"];

function files(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(full);
  }
  return out;
}

const sources = SCANNED.flatMap((d) => files(join(ROOT, d))).map((f) => {
  const file = relative(ROOT, f).replace(/\\/g, "/");
  const text = readFileSync(f, "utf8");
  return {
    file,
    sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  };
});

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const LETTER = /[A-Za-z؀-ۿ]/;

// ─── Exceptions ──────────────────────────────────────────────────────────

/**
 * Words that are the same in both languages on purpose. Matched against
 * the whole literal, trimmed.
 */
const SAME_IN_BOTH = new Set([
  "Maw3ed", // the brand, in Latin letters
  "موعد", // the brand, in Arabic
  "م", // the brand mark's single letter (home hero), a logo rather than a word
  "WhatsApp",
  "Google Maps",
  "Instagram",
  "Facebook",
  "TikTok",
  "EGP", // currency codes
  "USD",
  // The language toggles name each language in itself, so whoever cannot
  // read the current one can still find their own.
  "English",
  "العربية",
]);

/**
 * Pairs that are deliberately in the *other* language: the language
 * toggle's label reads in the language it switches to.
 */
const OTHER_LANGUAGE_PAIRS = new Set([
  "English|العربية",
  "Switch to English|التحويل للعربية",
]);

/**
 * Files that are data rather than copy: a bilingual table read through
 * an accessor that picks the reader's language.
 */
const DATA_FILES = new Set([
  "features/auth/countries.ts", // `iso|dial|English|Arabic` rows; name(country) picks by lang
]);

/**
 * Screens that are not shipped UI: the dev-only design-system showcase
 * shows both languages side by side, with sample names. Its pairs are
 * still checked; stray words are not.
 */
const INTERNAL = [/^app\/dev\//, /^features\/dev\//];

/** English that may appear untranslated in JSX text or label props. */
function englishAllowed(s: string): boolean {
  const v = s.trim();
  if (SAME_IN_BOTH.has(v)) return true;
  if (/^https?:\/\//.test(v) || /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return true; // URLs, emails
  return false;
}

// ─── Translation constructs ─────────────────────────────────────────────

const TRANSLATORS = new Set(["T"]);

type Side = "ar" | "en";

/** A literal's text, with `${…}` slots as "{x}" — the slots are checked on their own. */
function stringValue(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) {
    return n.head.text + n.templateSpans.map((s) => "{x}" + s.literal.text).join("");
  }
  if (ts.isParenthesizedExpression(n)) return stringValue(n.expression);
  return null;
}

/** `ar`, `isRTL`, `lang === "ar"`, `x.lang !== "en"` → "ar"; the reverse → "en". */
function languageTest(cond: ts.Expression): Side | null {
  let c: ts.Expression = cond;
  while (ts.isParenthesizedExpression(c)) c = c.expression;
  if (ts.isIdentifier(c) && /^(ar|isAr|isArabic|isRTL)$/.test(c.text)) return "ar";
  if (ts.isPropertyAccessExpression(c) && c.name.text === "isRTL") return "ar";
  if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = languageTest(c.operand);
    return inner === "ar" ? "en" : inner === "en" ? "ar" : null;
  }
  if (ts.isBinaryExpression(c)) {
    const op = c.operatorToken.kind;
    const eq = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
    const ne = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
    if (!eq && !ne) return null;
    const lit = ts.isStringLiteral(c.right) ? c.right.text : ts.isStringLiteral(c.left) ? c.left.text : null;
    const other = ts.isStringLiteral(c.right) ? c.left : c.right;
    const isLang =
      (ts.isIdentifier(other) && /lang/i.test(other.text)) ||
      (ts.isPropertyAccessExpression(other) && /lang/i.test(other.name.text));
    if (!isLang || (lit !== "ar" && lit !== "en")) return null;
    const side: Side = lit === "ar" ? "ar" : "en";
    return eq ? side : side === "ar" ? "en" : "ar";
  }
  return null;
}

function propName(n: ts.PropertyName): string | null {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n)) return n.text;
  return null;
}

function sideOfKey(key: string | null): Side | null {
  if (!key) return null;
  if (key === "ar" || /[a-z0-9]Ar$/.test(key)) return "ar";
  if (key === "en" || /[a-z0-9]En$/.test(key)) return "en";
  return null;
}

/** `X_AR`, `xAr`, `ar` — or `X` when the file also declares `X_EN` / `XEn`. */
function sideOfVariable(name: string, declared: Set<string>): Side | null {
  if (/^(ar|AR)$|_AR$|[a-z0-9]Ar$/.test(name)) return "ar";
  if (/^(en|EN)$|_EN$|[a-z0-9]En$/.test(name)) return "en";
  if (declared.has(`${name}_EN`) || declared.has(`${name}En`)) return "ar";
  return null;
}

/** `if (<test>) return …` or `if (<test>) { …; return … }`. */
function returningLanguageBranch(s: ts.Statement): Side | null {
  if (!ts.isIfStatement(s) || s.elseStatement) return null;
  const test = languageTest(s.expression);
  if (!test) return null;
  const then = s.thenStatement;
  const last = ts.isBlock(then) ? then.statements[then.statements.length - 1] : then;
  return last && (ts.isReturnStatement(last) || ts.isThrowStatement(last)) ? test : null;
}

/**
 * Which side of a translation construct a literal is on, or null when it
 * is in none. Walks up through the shapes copy is built from —
 * concatenation, template slots, plural ternaries, nested tables, JSX
 * inside a language branch.
 */
function translationSide(node: ts.Node, declared: Set<string>): Side | null {
  let child: ts.Node = node;
  let parent: ts.Node | undefined = node.parent;
  while (parent) {
    if (ts.isCallExpression(parent)) {
      if (ts.isIdentifier(parent.expression) && TRANSLATORS.has(parent.expression.text)) {
        const offset = parent.arguments.length === 3 ? 1 : 0;
        const i = parent.arguments.indexOf(child as ts.Expression) - offset;
        if (i === 0) return "ar";
        if (i === 1) return "en";
      }
      return null;
    }
    if (ts.isConditionalExpression(parent) && child !== parent.condition) {
      const test = languageTest(parent.condition);
      if (test) {
        const onTrue = child === parent.whenTrue;
        return test === "ar" ? (onTrue ? "ar" : "en") : onTrue ? "en" : "ar";
      }
    } else if (ts.isPropertyAssignment(parent) && child === parent.initializer && sideOfKey(propName(parent.name))) {
      return sideOfKey(propName(parent.name));
    } else if (ts.isArrayLiteralExpression(parent) && parent.elements.length === 2 && parent.elements.every((e) => stringValue(e) !== null)) {
      const first = stringValue(parent.elements[0]!) ?? "";
      if (ARABIC.test(first)) return parent.elements[0] === child ? "ar" : "en";
    } else if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      const side = sideOfVariable(parent.name.text, declared);
      if (side) return side;
    } else if (ts.isIfStatement(parent) && child === parent.thenStatement) {
      const test = languageTest(parent.expression);
      if (test) return test;
    } else if (ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isCaseClause(parent)) {
      // An earlier `if (lang === "en") return …` makes what follows Arabic.
      const statements = parent.statements as ts.NodeArray<ts.Statement>;
      const here = statements.indexOf(child as ts.Statement);
      for (let i = 0; i < here; i++) {
        const branch = returningLanguageBranch(statements[i]!);
        if (branch) return branch === "en" ? "ar" : "en";
      }
      if (ts.isSourceFile(parent) || ts.isFunctionLike(parent.parent)) return null;
    }
    const passThrough =
      ts.isParenthesizedExpression(parent) ||
      ts.isTemplateSpan(parent) ||
      ts.isTemplateExpression(parent) ||
      ts.isObjectLiteralExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isConditionalExpression(parent) ||
      ts.isReturnStatement(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isVariableDeclarationList(parent) ||
      ts.isVariableStatement(parent) ||
      ts.isBlock(parent) ||
      ts.isIfStatement(parent) ||
      ts.isJsxElement(parent) ||
      ts.isJsxFragment(parent) ||
      ts.isJsxExpression(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxOpeningElement(parent) ||
      ts.isJsxAttributes(parent) ||
      ts.isJsxAttribute(parent) ||
      (ts.isBinaryExpression(parent) &&
        [ts.SyntaxKind.PlusToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(
          parent.operatorToken.kind,
        ));
    if (!passThrough) return null;
    child = parent;
    parent = parent.parent;
  }
  return null;
}

// ─── The scan ───────────────────────────────────────────────────────────

interface Finding {
  where: string;
  text: string;
}

/** Props whose string is read or shown to a person. */
const LABEL_PROPS = new Set([
  "accessibilityLabel",
  "accessibilityHint",
  "aria-label",
  "placeholder",
  "title",
  "subtitle",
  "label",
  "hint",
  "message",
  "body",
  "description",
  "helper",
  "error",
  "cta",
  "actionLabel",
  "headerTitle",
  "tabBarLabel",
  "tabBarAccessibilityLabel",
]);

const untranslatedArabic: Finding[] = [];
const untranslatedEnglish: Finding[] = [];
const brokenPairs: Finding[] = [];
const withoutLang: Finding[] = [];

function at(sf: ts.SourceFile, node: ts.Node): string {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${sf.fileName}:${line + 1}`;
}

function short(s: string): string {
  const v = s.replace(/\s+/g, " ").trim();
  return v.length > 60 ? v.slice(0, 57) + "…" : v;
}

function checkPair(sf: ts.SourceFile, node: ts.Node, ar: string, en: string) {
  const a = ar.trim();
  const e = en.trim();
  if (OTHER_LANGUAGE_PAIRS.has(`${a}|${e}`)) return;
  const where = at(sf, node);
  const words = (s: string) => LETTER.test(s) && !SAME_IN_BOTH.has(s);
  if (e === "" && words(a)) brokenPairs.push({ where, text: `English side empty for "${short(a)}"` });
  else if (a === e && words(a)) brokenPairs.push({ where, text: `English identical to Arabic: "${short(a)}"` });
  else if (ARABIC.test(e)) brokenPairs.push({ where, text: `English side has Arabic: "${short(e)}"` });
  if (words(a) && !ARABIC.test(a)) brokenPairs.push({ where, text: `Arabic side has no Arabic: "${short(a)}"` });
}

/** name → index of its `lang` parameter, for every function that defaults it to Arabic. */
const langParam = new Map<string, number>();
for (const { sf } of sources) {
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      const i = n.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === "lang" && !!p.initializer);
      if (i >= 0) langParam.set(n.name.text, i);
    }
  });
}

function declaredNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) names.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return names;
}

/** `X` / `X_EN` table twins: the same keys (or length), and English that is English. */
function checkTwins(sf: ts.SourceFile) {
  const tables = new Map<string, ts.Expression>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let init: ts.Expression = n.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init)) tables.set(n.name.text, init);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  const shape = (e: ts.Expression): Map<string, string | null> => {
    const out = new Map<string, string | null>();
    if (ts.isArrayLiteralExpression(e)) e.elements.forEach((el, i) => out.set(String(i), stringValue(el)));
    else if (ts.isObjectLiteralExpression(e))
      for (const p of e.properties) if (ts.isPropertyAssignment(p)) out.set(propName(p.name) ?? "?", stringValue(p.initializer));
    return out;
  };
  for (const [name, arTable] of tables) {
    const enName = [`${name}_EN`, `${name}En`, name.replace(/_AR$/, "_EN"), name.replace(/([a-z0-9])Ar$/, "$1En")].find(
      (n) => n !== name && tables.has(n),
    );
    if (!enName) continue;
    const a = shape(arTable);
    const e = shape(tables.get(enName)!);
    for (const k of a.keys()) if (!e.has(k)) brokenPairs.push({ where: at(sf, arTable), text: `${enName} is missing "${k}"` });
    for (const [k, v] of e) {
      if (!a.has(k)) brokenPairs.push({ where: at(sf, arTable), text: `${name} is missing "${k}"` });
      else if (v !== null && a.get(k) !== null) checkPair(sf, tables.get(enName)!, a.get(k)!, v);
    }
  }
}

for (const { file, sf } of sources) {
  const internal = INTERNAL.some((r) => r.test(file));
  const data = DATA_FILES.has(file);
  const declared = declaredNames(sf);
  checkTwins(sf);

  const visit = (node: ts.Node): void => {
    // Pairs.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && TRANSLATORS.has(node.expression.text)) {
      const args = node.arguments.length === 3 ? node.arguments.slice(1) : node.arguments;
      const a = args.length === 2 ? stringValue(args[0]!) : null;
      const e = args.length === 2 ? stringValue(args[1]!) : null;
      if (a !== null && e !== null) checkPair(sf, node, a, e);
    }
    if (ts.isConditionalExpression(node)) {
      const test = languageTest(node.condition);
      const t = stringValue(node.whenTrue);
      const f = stringValue(node.whenFalse);
      if (test && t !== null && f !== null && (ARABIC.test(t) || ARABIC.test(f))) {
        if (test === "ar") checkPair(sf, node, t, f);
        else checkPair(sf, node, f, t);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const get = (k: string) => {
        const p = node.properties.find((q) => ts.isPropertyAssignment(q) && propName(q.name) === k) as ts.PropertyAssignment | undefined;
        return p ? stringValue(p.initializer) : null;
      };
      const a = get("ar");
      const e = get("en");
      if (a !== null && e !== null) checkPair(sf, node, a, e);
    }
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2) {
      const a = stringValue(node.elements[0]!);
      const e = stringValue(node.elements[1]!);
      if (a !== null && e !== null && ARABIC.test(a)) checkPair(sf, node, a, e);
    }

    // Helpers that default the language, called without it.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const i = langParam.get(node.expression.text);
      // On the Arabic side of a pair the Arabic default is the right one.
      if (i !== undefined && node.arguments.length <= i && translationSide(node, declared) !== "ar") {
        withoutLang.push({ where: at(sf, node), text: `${node.expression.text}(…) without lang` });
      }
    }

    // Arabic outside a construct.
    if (!internal && !data) {
      if (ts.isJsxText(node) && ARABIC.test(node.text) && !SAME_IN_BOTH.has(node.text.trim()) && !translationSide(node, declared)) {
        untranslatedArabic.push({ where: at(sf, node), text: short(node.text) });
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        const v = stringValue(node) ?? "";
        if (ARABIC.test(v) && !SAME_IN_BOTH.has(v.trim()) && !translationSide(node, declared)) {
          untranslatedArabic.push({ where: at(sf, node), text: short(v) });
        }
      }
    }

    // English outside a construct, where it can only be UI.
    if (!internal) {
      if (ts.isJsxText(node) && LATIN_WORD.test(node.text) && !englishAllowed(node.text) && !translationSide(node, declared)) {
        untranslatedEnglish.push({ where: at(sf, node), text: short(node.text) });
      }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && LABEL_PROPS.has(node.name.text) && node.initializer) {
        let init: ts.Node = node.initializer;
        if (ts.isJsxExpression(init) && init.expression) init = init.expression;
        const v = stringValue(init);
        if (v !== null && LATIN_WORD.test(v) && !englishAllowed(v) && !translationSide(init, declared)) {
          untranslatedEnglish.push({ where: at(sf, node), text: `${node.name.text}="${short(v)}"` });
        }
      }
      // The same props built as objects: toasts, tab and screen options, option lists.
      if (ts.isPropertyAssignment(node) && LABEL_PROPS.has(propName(node.name) ?? "")) {
        const v = stringValue(node.initializer);
        if (v !== null && LATIN_WORD.test(v) && !englishAllowed(v) && !translationSide(node.initializer, declared)) {
          untranslatedEnglish.push({ where: at(sf, node), text: `${propName(node.name)}: "${short(v)}"` });
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const list = (fs: Finding[]) => fs.map((f) => `${f.where}  ${f.text}`);

// I18N_REPORT=path writes every finding to a file — a failure diff truncates long lists.
if (process.env.I18N_REPORT) {
  writeFileSync(
    process.env.I18N_REPORT,
    JSON.stringify(
      {
        untranslatedArabic: list(untranslatedArabic),
        untranslatedEnglish: list(untranslatedEnglish),
        brokenPairs: list(brokenPairs),
        withoutLang: list(withoutLang),
      },
      null,
      2,
    ),
  );
}

// ─── Dictionaries ───────────────────────────────────────────────────────

async function dictionaries(): Promise<{ name: string; ar: Record<string, unknown>; en: Record<string, unknown> }[]> {
  const { strings } = await import("./design/strings");
  const iosAr = JSON.parse(readFileSync(join(ROOT, "locales/ar.json"), "utf8"));
  const iosEn = JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8"));
  return [
    { name: "design/strings.ts", ar: strings.ar, en: strings.en },
    { name: "locales/*.json (iOS)", ar: iosAr.ios, en: iosEn.ios },
  ];
}

describe("i18n", () => {
  it("found the source", () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it("has no Arabic outside a translation construct", () => {
    expect(list(untranslatedArabic)).toEqual([]);
  });

  it("has no hard-coded English in JSX text or label props", () => {
    expect(list(untranslatedEnglish)).toEqual([]);
  });

  it("has every Arabic/English pair complete and the right way round", () => {
    expect(list(brokenPairs)).toEqual([]);
  });

  it("passes the language to every helper that defaults it to Arabic", () => {
    expect(list(withoutLang)).toEqual([]);
  });

  it("has the same keys, none empty, in both languages of every dictionary", async () => {
    const problems: string[] = [];
    for (const d of await dictionaries()) {
      const a = Object.keys(d.ar);
      const e = Object.keys(d.en);
      for (const k of a) if (!e.includes(k)) problems.push(`${d.name}: "${k}" missing in en`);
      for (const k of e) if (!a.includes(k)) problems.push(`${d.name}: "${k}" missing in ar`);
      for (const [lang, dict] of [
        ["ar", d.ar],
        ["en", d.en],
      ] as const) {
        for (const [k, v] of Object.entries(dict)) {
          if (typeof v !== "string" || v.trim() === "") problems.push(`${d.name}: ${lang}.${k} is empty`);
          else if (lang === "en" && ARABIC.test(v)) problems.push(`${d.name}: en.${k} has Arabic`);
          else if (lang === "ar" && !ARABIC.test(v) && !SAME_IN_BOTH.has(v)) problems.push(`${d.name}: ar.${k} has no Arabic`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
