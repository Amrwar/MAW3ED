import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ PixelRatio: { get: () => 3 } }));

const { sizedFor, stepFor } = await import("./image");

describe("image sizing", () => {
  it("rounds up to a step, and caps the scale at 3", () => {
    expect(stepFor(64, 3)).toBe(256);
    expect(stepFor(56, 2)).toBe(128);
    expect(stepFor(390, 3)).toBe(1280);
    expect(stepFor(2000, 4)).toBe(1600);
  });

  it("asks Cloudinary for the width, an automatic format and quality", () => {
    expect(sizedFor("https://res.cloudinary.com/demo/image/upload/v1712/maw3ed/abc.jpg", 512)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_512/v1712/maw3ed/abc.jpg",
    );
  });

  it("leaves a Cloudinary URL that already has a transformation alone", () => {
    const u = "https://res.cloudinary.com/demo/image/upload/w_300/v1/x.jpg";
    expect(sizedFor(u, 512)).toBe(u);
  });

  it("replaces Unsplash's width and asks for the best format", () => {
    const out = new URL(sizedFor("https://images.unsplash.com/photo-1?w=1600&q=70", 384));
    expect(out.searchParams.get("w")).toBe("384");
    expect(out.searchParams.get("auto")).toBe("format");
  });

  it("never touches another host or something that is not a URL", () => {
    expect(sizedFor("https://example.com/a.jpg", 256)).toBe("https://example.com/a.jpg");
    expect(sizedFor("file:///x.png", 256)).toBe("file:///x.png");
    expect(sizedFor("not a url", 256)).toBe("not a url");
  });
});
