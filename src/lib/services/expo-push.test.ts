import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, error: () => undefined } }));

import { isExpoToken, sendExpoPush } from "./expo-push";

const msg = (to: string) => ({ to, title: "t" });
const noWait = async () => undefined;

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("sending through Expo", () => {
  it("recognises Expo tokens and nothing else", () => {
    expect(isExpoToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isExpoToken("ExpoPushToken[abc]")).toBe(true);
    expect(isExpoToken("fcm:raw-device-token")).toBe(false);
  });

  it("returns a ticket per message and collects tokens Expo says are dead", async () => {
    const fetchMock = vi.fn(async () =>
      respond(200, {
        data: [
          { status: "ok", id: "a" },
          { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
        ],
      }),
    );
    const r = await sendExpoPush([msg("ExponentPushToken[1]"), msg("ExponentPushToken[2]")], fetchMock as typeof fetch, noWait);
    expect(r.tickets.map((t) => t?.status)).toEqual(["ok", "error"]);
    expect(r.deadTokens).toEqual(["ExponentPushToken[2]"]);
  });

  it("retries a rate limit or server error, then succeeds", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => (++calls < 3 ? respond(503, {}) : respond(200, { data: [{ status: "ok", id: "x" }] })));
    const r = await sendExpoPush([msg("ExponentPushToken[1]")], fetchMock as typeof fetch, noWait);
    expect(calls).toBe(3);
    expect(r.tickets[0]?.status).toBe("ok");
  });

  it("gives up after the retries without throwing", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const r = await sendExpoPush([msg("ExponentPushToken[1]")], fetchMock as typeof fetch, noWait);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(r.tickets).toEqual([null]);
  });

  it("splits more than 100 messages into batches", async () => {
    const sizes: number[] = [];
    const fetchMock = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const batch = JSON.parse(String(init?.body)) as unknown[];
      sizes.push(batch.length);
      return respond(200, { data: batch.map(() => ({ status: "ok", id: "i" })) });
    });
    await sendExpoPush(Array.from({ length: 230 }, (_, i) => msg(`ExponentPushToken[${i}]`)), fetchMock as typeof fetch, noWait);
    expect(sizes).toEqual([100, 100, 30]);
  });
});
