/**
 * Serialising JSON-LD into a <script> tag, safely.
 *
 * JSON.stringify does not escape "<". A business whose name is
 *
 *   Salon</script><script>alert(document.cookie)</script>
 *
 * closes the structured-data block and opens a real one, on its own
 * public profile, for every visitor — including signed-in customers.
 * Business names, taglines and about text are all owner-supplied and
 * all end up in the LocalBusiness payload, so this was reachable by
 * anybody who could create a listing.
 *
 * Escaping the angle brackets and the ampersand is enough for markup:
 * they are valid JSON escapes, they parse back to the same string, and
 * they leave nothing a browser will read as a tag. U+2028 and U+2029 go
 * too — they are legal inside a JSON string and are line terminators in
 * JavaScript, which is a different way out of the same box.
 *
 * Those two are built from their code points rather than written down.
 * A literal U+2028 in this file would end the line it sits on, which is
 * the bug itself, one level up.
 */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  [LINE_SEP]: "\\u2028",
  [PARA_SEP]: "\\u2029",
};

const UNSAFE = new RegExp(`[<>&${LINE_SEP}${PARA_SEP}]`, "g");

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (c) => ESCAPES[c]);
}
