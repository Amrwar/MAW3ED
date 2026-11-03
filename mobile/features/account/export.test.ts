import { beforeEach, describe, expect, it, vi } from "vitest";

// The phone's cache, as a list of file names, and what the share sheet does.
const cache = new Set<string>();
const share = vi.fn<(uri: string) => Promise<void>>();

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/lib/api/client", () => ({ api: { get: async () => ({ profile: { name: "Sara" } }) } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: (uri: string) => share(uri) }));
vi.mock("expo-file-system", () => {
  class File {
    constructor(_dir: unknown, public name: string) {}
    get uri() {
      return `file:///cache/${this.name}`;
    }
    create() {
      cache.add(this.name);
    }
    write() {}
    delete() {
      cache.delete(this.name);
    }
  }
  class Directory {
    list() {
      return [...cache].map((n) => new File(null, n));
    }
  }
  return { File, Directory, Paths: { cache: "cache" } };
});

const { exportMyData, forgetExports, isExportFile } = await import("./export");

beforeEach(() => {
  cache.clear();
  share.mockReset();
});

describe("a data export is not left on the phone", () => {
  it("names only the app's own exports", () => {
    expect(isExportFile("maw3ed-my-data-2026-11-03.json")).toBe(true);
    expect(isExportFile("maw3ed-my-data-2026-11-03.png")).toBe(false);
    expect(isExportFile("photo.json")).toBe(false);
  });
  it("goes from the cache once the share sheet is done", async () => {
    share.mockResolvedValue(undefined);
    expect(await exportMyData()).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect([...cache]).toEqual([]);
  });
  it("goes even when the share sheet fails", async () => {
    share.mockRejectedValue(new Error("closed"));
    await expect(exportMyData()).rejects.toThrow("closed");
    expect([...cache]).toEqual([]);
  });
  it("and on sign-out every leftover export goes, nothing else", async () => {
    cache.add("maw3ed-my-data-2026-10-01.json");
    cache.add("image-cache.bin");
    await forgetExports();
    expect([...cache]).toEqual(["image-cache.bin"]);
  });
});
