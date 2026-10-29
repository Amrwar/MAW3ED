import { describe, expect, it } from "vitest";
import { sniffImageType } from "./image-sniff";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("image sniffing", () => {
  it("recognises the three allowed formats by their magic numbers", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0]))).toBe("image/webp");
  });

  it("rejects anything else, however it is labelled", () => {
    expect(sniffImageType(new Uint8Array(Buffer.from("<svg onload=alert(1)>")))).toBeNull();
    expect(sniffImageType(new Uint8Array(Buffer.from("GIF89a")))).toBeNull();
    expect(sniffImageType(new Uint8Array(Buffer.from("%PDF-1.4")))).toBeNull();
    expect(sniffImageType(new Uint8Array(Buffer.from("MZ\x90\x00")))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
