import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { log, addSink, resetSinks, redact, type LogRecord } from "@/lib/logger";

describe("redact", () => {
  it("masks personal fields rather than dropping the key", () => {
    const out = redact({ customerName: "Mariam Abdelrahman" }) as Record<string, string>;
    expect(out.customerName).toBe("Ma***an");
  });

  it("redacts secrets outright", () => {
    const out = redact({
      apiKey: "sk_live_abc123",
      hmacSecret: "shh",
      authorization: "Bearer x",
    }) as Record<string, string>;
    expect(out.apiKey).toBe("[redacted]");
    expect(out.hmacSecret).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
  });

  it("strips Egyptian phone numbers out of free text", () => {
    const out = redact({ note: "call me on 01012345678 today" }) as Record<string, string>;
    expect(out.note).toBe("call me on [phone] today");
  });

  it("strips numbers from other countries too", () => {
    const out = redact({ note: "+966 50 123 4567 or 00447700900123 or 14155552671" }) as Record<string, string>;
    expect(out.note).toBe("[phone] or [phone] or [phone]");
  });

  it("leaves dates, times and short numbers alone", () => {
    const out = redact({ note: "booked 2026-10-12 at 14:30 for 2 people, ref 4821" }) as Record<string, string>;
    expect(out.note).toBe("booked 2026-10-12 at 14:30 for 2 people, ref 4821");
  });

  it("strips phone numbers written with a country code", () => {
    const out = redact({ note: "+201112223334" }) as Record<string, string>;
    expect(out.note).toBe("[phone]");
  });

  it("strips a number glued to a word", () => {
    const out = redact({ note: "user_01012345678 and id966501234567" }) as Record<string, string>;
    expect(out.note).toBe("user_[phone] and id[phone]");
  });

  it("strips email addresses out of free text", () => {
    const out = redact({ note: "mail hefny@example.com back" }) as Record<string, string>;
    expect(out.note).toBe("mail [email] back");
  });

  it("keeps non-personal values intact", () => {
    const out = redact({ bookingId: "bk_1", total: 300, ok: true }) as Record<string, unknown>;
    expect(out).toEqual({ bookingId: "bk_1", total: 300, ok: true });
  });

  it("serialises errors without losing the message", () => {
    const out = redact(new Error("boom")) as { name: string; message: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
  });

  it("scrubs personal data out of an error message", () => {
    const out = redact(new Error("failed for 01012345678")) as { message: string };
    expect(out.message).toBe("failed for [phone]");
  });

  it("stops at a sane depth instead of recursing forever", () => {
    type Nested = { next?: Nested };
    const root: Nested = {};
    let node = root;
    for (let i = 0; i < 12; i++) {
      node.next = {};
      node = node.next;
    }
    expect(() => redact(root)).not.toThrow();
  });
});

describe("log", () => {
  let records: LogRecord[];

  beforeEach(() => {
    records = [];
    resetSinks();
    addSink((r) => records.push(r));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    resetSinks();
    vi.restoreAllMocks();
  });

  it("delivers a record to every registered sink", () => {
    log.info("booking created", { bookingId: "bk_1" });
    expect(records).toHaveLength(1);
    expect(records[0].level).toBe("info");
    expect(records[0].message).toBe("booking created");
    expect(records[0].fields.bookingId).toBe("bk_1");
  });

  it("redacts fields before a sink ever sees them", () => {
    log.info("reminder sent", { phone: "01012345678" });
    expect(records[0].fields.phone).not.toContain("0101234");
  });

  it("carries the error on error records", () => {
    const err = new Error("db down");
    log.error("query failed", err, { table: "booking" });
    expect(records[0].level).toBe("error");
    expect((records[0].error as { message: string }).message).toBe("db down");
    expect(records[0].fields.table).toBe("booking");
  });

  it("stamps child context onto every record", () => {
    const scoped = log.child({ route: "/api/business/bookings" });
    scoped.warn("slow query");
    expect(records[0].fields.route).toBe("/api/business/bookings");
  });

  it("merges child context with per-call fields", () => {
    log.child({ route: "/api/x" }).info("hit", { status: 200 });
    expect(records[0].fields).toMatchObject({ route: "/api/x", status: 200 });
  });

  it("keeps serving other sinks when one throws", () => {
    addSink(() => {
      throw new Error("sink is broken");
    });
    const after: LogRecord[] = [];
    addSink((r) => after.push(r));

    expect(() => log.info("still fine")).not.toThrow();
    expect(after).toHaveLength(1);
  });
});
