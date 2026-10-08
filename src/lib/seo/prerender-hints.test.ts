import { describe, it, expect, vi } from "vitest";
import { prerenderHints } from "./landing";

/**
 * A build must not need a database.
 *
 * generateStaticParams and the sitemap read one, Next runs both while
 * building, and a build with no reachable database died twice over:
 * "Failed to collect page data for /[city]/[category]", then "Error
 * occurred prerendering page /sitemap.xml". Both surfaced as a bare
 * ErrorEvent with no message.
 *
 * That is what CI does — it builds with a placeholder DATABASE_URL —
 * and it went unseen for months because a formatting check ahead of it
 * meant the build step never ran.
 *
 * All three landing routes set `dynamicParams = true`, so a page left
 * out of the list is not missing; it renders on demand. The list is an
 * optimisation, and an optimisation must not be able to fail a build.
 */

describe("prerender hints", () => {
  it("passes the data through when the database answers", async () => {
    const rows = [{ slug: "cairo" }, { slug: "giza" }];
    expect(await prerenderHints("cities", async () => rows)).toBe(rows);
  });

  it("returns nothing rather than throwing when it cannot", async () => {
    // The whole point. Throwing here fails the build.
    const result = await prerenderHints("cities", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(result).toEqual([]);
  });

  it("survives a thrown value that is not an Error", async () => {
    // Both real failures arrived as an ErrorEvent, not an Error, and a
    // handler that assumed `e.message` would have thrown while
    // reporting the thing it was meant to absorb.
    const result = await prerenderHints("cities", async () => {
      throw { type: "error", timeStamp: 2245 };
    });
    expect(result).toEqual([]);
  });

  it("warns rather than errors", async () => {
    // On a build without a database this is expected. Logging it at
    // error level would teach people to ignore errors.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await prerenderHints("cities", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it("names what it could not read", async () => {
    // The log line is the only sign these pages were not prerendered,
    // so it has to say which ones.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await prerenderHints("city/category combos", async () => {
      throw new Error("ECONNREFUSED");
    });
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("city/category combos");
    warn.mockRestore();
  });
});
