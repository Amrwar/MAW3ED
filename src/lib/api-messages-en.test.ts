import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { MESSAGES, TEMPLATES, countOf, englishFor, toEnglish } from "./api-messages-en";

/**
 * Every Arabic message the API can answer with has an English one.
 *
 * Routes write their messages in Arabic; err() swaps in the English
 * from lib/api-messages-en.ts when the request is English. A sentence
 * missing from there would still reach an English page as a vague
 * fallback, so this reads the source and fails on any message without
 * a translation — a new one cannot be added Arabic-only.
 *
 * What counts as a message:
 *   - anything under src/app/api, except the Arabic that is not an
 *     answer: audit-log summaries, WhatsApp texts, calendar files;
 *   - in src/lib, the first argument of err(), an `error`, `message`
 *     or `reason` property, a Zod schema's messages, and the tables of
 *     refusals routes answer from (*_MESSAGES, REASON_TEXT, …).
 */

const ROOT = process.cwd();
const ARABIC = /[\u0600-\u06FF]/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) files(rel, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(rel);
  }
  return out;
}

/** Calls whose Arabic arguments are records, not answers. */
const NOT_ANSWERS_CALLS = new Set(["venueAudit", "audit", "recordAudit", "logAdminAction", "sendCode", "sendWhatsAppText"]);
/** Properties whose Arabic values are records, not answers. */
const NOT_ANSWERS_PROPS = new Set(["summary", "actorName", "failureReason", "reading", "detail"]);
/** Whole route files that write Arabic for something other than an answer. */
const NOT_ANSWERS_FILES = new Set([
  // An .ics file for the customer's calendar app.
  "src/app/api/public/booking/[token]/calendar/route.ts",
  // Readings for the admin diagnostics screen, an Arabic-only tool.
  "src/app/api/admin/payments/diagnostics/route.ts",
  // The interface's own dictionary: every entry already has its English.
  "src/lib/i18n.ts",
]);
/** Variables (anywhere) holding answers. */
const ANSWER_VARS = /(^|_)MESSAGES$|^REASON_TEXT$|^FAILURE_AR$|^PHONE_INVALID$|^NAME_TOO_LONG$/;
const ANSWER_PROPS = new Set(["error", "message", "reason", "codeError"]);
/** Variables (in routes) holding audit text, set before the audit call. */
const RECORD_VARS = /summary|lead|actor|whatsAppText/i;

function calleeName(call: ts.CallExpression | ts.NewExpression): string {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return "";
}

/** Whether a call chain starts at `z` (a Zod schema). */
function isZod(node: ts.Node): boolean {
  let e: ts.Node = node;
  while (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e)) e = e.expression;
  return ts.isIdentifier(e) && e.text === "z";
}

interface Found {
  file: string;
  line: number;
  /** The exact sentence, or the template with {0}, {1}… for its ${…}. */
  key: string;
  template: boolean;
}

function classify(file: string, node: ts.Node): "answer" | "record" | "unknown" {
  const inApi = file.startsWith("src/app/api/");
  for (let p: ts.Node | undefined = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      const name = calleeName(p);
      if (NOT_ANSWERS_CALLS.has(name)) return "record";
      if (name === "err" || name === "errorResponse") return "answer";
      if (ts.isCallExpression(p) && isZod(p)) return "answer";
    }
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      if (NOT_ANSWERS_PROPS.has(p.name.text)) return "record";
      if (ANSWER_PROPS.has(p.name.text)) return "answer";
    }
    if (
      inApi &&
      ts.isBinaryExpression(p) &&
      p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(p.left) &&
      RECORD_VARS.test(p.left.text)
    ) {
      return "record";
    }
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      if (ANSWER_VARS.test(p.name.text)) return "answer";
      if (inApi && RECORD_VARS.test(p.name.text)) return "record";
    }
  }
  return inApi ? "answer" : "unknown";
}

function templateKey(node: ts.TemplateExpression): string {
  let key = node.head.text;
  node.templateSpans.forEach((span, i) => {
    key += `{${i}}${span.literal.text}`;
  });
  return key;
}

function scan(): Found[] {
  const found: Found[] = [];
  const all = [...files("src/app/api"), ...files("src/lib")].filter((f) => f !== "src/lib/api-messages-en.ts");
  for (const file of all) {
    if (NOT_ANSWERS_FILES.has(file)) continue;
    const text = readFileSync(join(ROOT, file), "utf8");
    if (!ARABIC.test(text)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      let key: string | null = null;
      let template = false;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) key = node.text;
      else if (ts.isTemplateExpression(node)) {
        key = templateKey(node);
        template = true;
      }
      if (key !== null && ARABIC.test(key)) {
        if (classify(file, node) === "answer") {
          found.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, key: key.trim(), template });
        }
        if (template) return; // its ${…} parts are part of the sentence
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

describe("API messages in English", () => {
  const found = scan();

  it("finds the messages (the scan itself works)", () => {
    expect(found.length).toBeGreaterThan(200);
    expect(found.some((f) => f.key === "سجّل دخولك الأول")).toBe(true);
  });

  it("every Arabic message the API can answer with has an English translation", () => {
    const missing = found.filter((f) => (f.template ? !(f.key in TEMPLATES) : !MESSAGES[f.key]));
    const report = [...new Set(missing.map((m) => `${m.file}:${m.line}  ${JSON.stringify(m.key)}`))];
    expect(report).toEqual([]);
  });

  it("no translation is itself Arabic", () => {
    const arabic = Object.entries(MESSAGES).filter(([, en]) => ARABIC.test(en));
    const arabicTemplates = Object.entries(TEMPLATES).filter(([, en]) => typeof en === "string" && ARABIC.test(en));
    expect([...arabic, ...arabicTemplates]).toEqual([]);
  });

  it("every template's English uses only the values its Arabic has", () => {
    for (const [ar, en] of Object.entries(TEMPLATES)) {
      if (typeof en !== "string") continue;
      const have = new Set(ar.match(/\{\d+\}/g) ?? []);
      for (const mark of en.match(/\{\d+\}/g) ?? []) expect(have.has(mark), `${ar} → ${en}`).toBe(true);
    }
  });

  it("every template matches a sentence built from it, in English", () => {
    for (const ar of Object.keys(TEMPLATES)) {
      const sample = ar.replace(/\{\d+\}/g, "7");
      const en = englishFor(sample);
      expect(en, ar).not.toBeNull();
      expect(ARABIC.test(en ?? ""), `${ar} → ${en}`).toBe(false);
    }
  });
});

describe("englishFor / toEnglish", () => {
  it("translates a known sentence", () => {
    expect(englishFor("سجّل دخولك الأول")).toBe(MESSAGES["سجّل دخولك الأول"]);
    expect(toEnglish("معرفناش نبعت الكود دلوقتي. جرّب تاني بعد شوية.", 503)).toBe(
      "We couldn't send the code right now. Try again in a little while.",
    );
  });

  it("fills a template, translating digits and the currency", () => {
    expect(englishFor("المبلغ أكبر من المتبقي (١٢٠ ج.م)")).toBe("The amount is more than what's left (120 EGP).");
    expect(englishFor("التقييم بيتقفل بعد 30 يوم من الموعد")).toMatch(/30 days/);
  });

  it("reads Arabic counts", () => {
    expect(countOf("محاولة واحدة")).toBe(1);
    expect(countOf("محاولتين")).toBe(2);
    expect(countOf("٣ محاولات")).toBe(3);
    expect(englishFor("الكود غير صحيح — باقي محاولتين")).toBe("That code isn't right. 2 tries left.");
    expect(englishFor("الكود غير صحيح — باقي محاولة واحدة")).toBe("That code isn't right. 1 try left.");
  });

  it("passes English through and never returns Arabic", () => {
    expect(toEnglish("Booking not found", 404)).toBe("Booking not found");
    expect(toEnglish("جملة جديدة مش معروفة", 404)).toBe("We couldn't find that.");
    expect(ARABIC.test(toEnglish("جملة جديدة", 500))).toBe(false);
  });
});
