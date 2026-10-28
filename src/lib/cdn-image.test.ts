import { describe, expect, it } from "vitest";

import { cdnImage, cdnShareImage } from "./cdn-image";

const up = "https://res.cloudinary.com/demo/image/upload/v1712/maw3ed/covers/abc.png";

describe("cdnImage", () => {
  it("asks Cloudinary for the shown width in an automatic format", () => {
    expect(cdnImage(up, 640)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1712/maw3ed/covers/abc.png",
    );
  });

  it("leaves other hosts, existing transformations and empty values alone", () => {
    for (const u of [
      "https://images.unsplash.com/photo-1?w=800",
      "/og.png",
      "https://res.cloudinary.com/demo/image/upload/w_200/v1/a.png",
      "https://res.cloudinary.com/demo/video/upload/v1/a.mp4",
      "not a url",
    ]) {
      expect(cdnImage(u, 640), u).toBe(u);
    }
    expect(cdnImage(null, 640)).toBeNull();
    expect(cdnImage(undefined, 640)).toBeUndefined();
  });

  it("crops a share image to the size the og:image tag declares", () => {
    expect(cdnShareImage(up)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/v1712/maw3ed/covers/abc.png",
    );
    expect(cdnShareImage("/og.png")).toBe("/og.png");
  });
});
