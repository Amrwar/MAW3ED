import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "http";
import { isPrivateAddress, postPinned } from "./ssrf";

/**
 * The webhook send checks the address it connects to (final audit F-23).
 * Before, the URL was checked by one DNS lookup and fetched by another, so
 * a host answering a public address for the check and an internal one for
 * the connection (DNS rebinding) reached the internal address.
 *
 * "localhost" stands in for the rebinding host: a name whose answer is a
 * private address at connect time.
 */

let server: Server;
let port = 0;
let hits = 0;

beforeAll(async () => {
  server = createServer((_req, res) => {
    hits++;
    res.statusCode = 204;
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
afterEach(() => {
  delete process.env.WEBHOOK_ALLOW_PRIVATE;
});

describe("postPinned", () => {
  it("refuses to connect when the name resolves to a private address", async () => {
    hits = 0;
    const e = await postPinned(new URL(`http://localhost:${port}/hook`), {}, "{}", 2000).catch((x) => x);
    expect((e as { code?: string }).code).toBe("EPRIVATE");
    expect(hits).toBe(0);
  });

  it("connects when private targets are allowed (local QA only)", async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = "1";
    const prev = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      expect(await postPinned(new URL(`http://localhost:${port}/hook`), {}, "{}", 2000)).toBe(204);
    } finally {
      if (prev !== undefined) process.env.VERCEL = prev;
    }
  });
});

describe("isPrivateAddress, embedded IPv4", () => {
  it("refuses NAT64, 6to4 and IPv4-compatible forms", () => {
    expect(isPrivateAddress("64:ff9b::a9fe:a9fe")).toBe(true);
    expect(isPrivateAddress("2002:a9fe:a9fe::1")).toBe(true);
    expect(isPrivateAddress("::7f00:1")).toBe(true);
    expect(isPrivateAddress("::127.0.0.1")).toBe(true);
  });

  it("still allows an ordinary public IPv6 address", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});
