import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { sizedSvg } from "./save-qr";

describe("the QR picture to save", () => {
  it("gets an explicit pixel size, keeping its viewBox and drawing", async () => {
    const svg = await QRCode.toString("https://www.maw3ed.net/c/abc", { type: "svg", margin: 2 });
    const out = sizedSvg(svg, 720);
    expect(out).toMatch(/<svg[^>]*\swidth="720"[^>]*\sheight="720"/);
    expect(out).toContain('viewBox="');
    expect(out.replace(/<svg[^>]*>/, "")).toBe(svg.replace(/<svg[^>]*>/, ""));
  });

  it("replaces a size already there rather than adding a second one", () => {
    const out = sizedSvg('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>', 300);
    expect(out.match(/width=/g)).toHaveLength(1);
    expect(out).toContain('width="300" height="300"');
  });
});
