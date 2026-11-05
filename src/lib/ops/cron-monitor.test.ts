import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureCheckIn: vi.fn(() => "check-in-1"),
  flush: vi.fn(async () => true),
}));
vi.mock("@sentry/nextjs", () => sentry);

const cronRun = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "run-1" })),
  update: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({ db: { cronRun } }));
vi.mock("@/lib/security/cron-auth", () => ({ authorizeCron: () => ({ ok: true }) }));

import { CRON_SCHEDULES, monitorsEnabled, startCheckIn } from "./cron-monitor";
import { withCronRun } from "./cron-run";

const ROOT = join(__dirname, "..", "..", "..");
const PROD = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "www.maw3ed.net" };

describe("cron monitor schedules", () => {
  it("match vercel.json exactly", () => {
    const crons = (JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")).crons ?? []) as { path: string; schedule: string }[];
    const fromVercel = Object.fromEntries(crons.map((c) => [c.path.replace("/api/cron/", ""), c.schedule]));
    expect(CRON_SCHEDULES).toEqual(fromVercel);
  });

  it("cover every job that runs through withCronRun", () => {
    const dir = join(ROOT, "src", "app", "api", "cron");
    const jobs = readdirSync(dir).flatMap((d) => {
      const m = readFileSync(join(dir, d, "route.ts"), "utf8").match(/withCronRun\("([a-z-]+)"/);
      return m ? [m[1]] : [];
    });
    expect(jobs.sort()).toEqual(Object.keys(CRON_SCHEDULES).sort());
  });
});

describe("monitorsEnabled", () => {
  it("is on only for the production site", () => {
    expect(monitorsEnabled({ ...PROD })).toBe(true);
    expect(monitorsEnabled({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "maw3ed.net" })).toBe(true);
    expect(monitorsEnabled({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "maw3ed-staging.vercel.app" })).toBe(false);
    expect(monitorsEnabled({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "evilmaw3ed.net" })).toBe(false);
    expect(monitorsEnabled({ ...PROD, VERCEL_ENV: "preview" })).toBe(false);
    expect(monitorsEnabled({ ...PROD, SENTRY_CRON_MONITORS: "0" })).toBe(false);
    expect(monitorsEnabled({})).toBe(false);
  });
});

describe("check-ins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, PROD);
  });
  afterEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  it("opens with the job's schedule and closes ok, then flushes", async () => {
    const done = startCheckIn("notifications");
    expect(sentry.captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: "cron-notifications", status: "in_progress" },
      expect.objectContaining({ schedule: { type: "crontab", value: "*/10 * * * *" }, timezone: "UTC", maxRuntime: 6 }),
    );
    await done(true);
    expect(sentry.captureCheckIn).toHaveBeenLastCalledWith({ checkInId: "check-in-1", monitorSlug: "cron-notifications", status: "ok" });
    expect(sentry.flush).toHaveBeenCalled();
  });

  it("does nothing off production or for an unknown job", async () => {
    process.env.VERCEL_ENV = "preview";
    await startCheckIn("notifications")(true);
    process.env.VERCEL_ENV = "production";
    await startCheckIn("not-a-job")(true);
    expect(sentry.captureCheckIn).not.toHaveBeenCalled();
  });

  it("never fails the job when Sentry throws", async () => {
    sentry.captureCheckIn.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    const res = await withCronRun("access", new Request("http://x/api/cron/access"), async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
  });

  it("withCronRun reports ok, a failed summary, and a throw", async () => {
    const status = () => (sentry.captureCheckIn.mock.calls.at(-1) as unknown as [{ status: string }])[0].status;
    await withCronRun("access", new Request("http://x"), async () => Response.json({ ok: true }));
    expect(status()).toBe("ok");
    await withCronRun("access", new Request("http://x"), async () => Response.json({ ok: false }, { status: 500 }));
    expect(status()).toBe("error");
    await withCronRun("access", new Request("http://x"), async () => Response.json({ ok: false }));
    expect(status()).toBe("error");
    await expect(withCronRun("access", new Request("http://x"), async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(status()).toBe("error");
    expect(cronRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ok: true }) }));
  });
});
