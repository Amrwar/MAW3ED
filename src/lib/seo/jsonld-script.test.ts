import { describe, it, expect } from "vitest";
import { jsonLdScript } from "./jsonld-script";

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

describe("jsonLdScript", () => {
  it("does not let a business name close the script tag", () => {
    // The whole point. A listing named this way would otherwise run
    // script on its own public profile for every visitor to it.
    const evil = { name: "Salon</scr" + "ipt><scr" + "ipt>alert(1)</scr" + "ipt>" };
    const out = jsonLdScript(evil);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("still parses back to exactly the same value", () => {
    const data = {
      name: "صالون <b>Salah</b> & co",
      nested: { a: [1, 2, "<i>"] },
    };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it("escapes the JavaScript line terminators that are legal in JSON", () => {
    // U+2028 inside a <script> ends the statement even though JSON
    // considers it an ordinary character.
    const value = "x" + LINE_SEP + "y" + PARA_SEP + "z";
    const out = jsonLdScript({ a: value });
    expect(out).not.toContain(LINE_SEP);
    expect(out).not.toContain(PARA_SEP);
    expect(JSON.parse(out).a).toBe(value);
  });

  it("leaves ordinary Arabic alone", () => {
    const data = { name: "صالون صلاح" };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it("produces something a browser will not read as markup", () => {
    const out = jsonLdScript({ a: "</script><img src=x onerror=alert(1)>" });
    expect(/<[a-zA-Z/]/.test(out)).toBe(false);
  });
});
