import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@tanstack/query-async-storage-persister", () => ({ createAsyncStoragePersister: () => ({}) }));
vi.mock("@/constants/version", () => ({ VERSION_LABEL: "test" }));

const { isPersistable } = await import("./persist");

const q = (queryKey: unknown[], status = "success") => ({ queryKey, state: { status } }) as never;

describe("what may be kept on the phone", () => {
  it("keeps the public catalogue", () => {
    expect(isPersistable(q(["businesses", "search", { city: "cairo" }]))).toBe(true);
    expect(isPersistable(q(["businesses", "profile", "qa-salon"]))).toBe(true);
    expect(isPersistable(q(["facets", ""]))).toBe(true);
  });

  it("never keeps anything about a person, or where they are", () => {
    for (const key of [["my-bookings", "upcoming"], ["favorites"], ["profile"], ["notifications"], ["booking", "abc"], ["business", "overview"], ["account", "payments"], ["admin"]]) {
      expect(isPersistable(q(key)), JSON.stringify(key)).toBe(false);
    }
    expect(isPersistable(q(["businesses", "nearby", 30.04, 31.23, 5]))).toBe(false);
  });

  it("never keeps a failed or unfinished query", () => {
    expect(isPersistable(q(["facets", ""], "error"))).toBe(false);
    expect(isPersistable(q(["facets", ""], "pending"))).toBe(false);
  });
});
