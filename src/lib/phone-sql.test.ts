import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { normalisePhone } from "./phone";
import { PHONE_CASES } from "./phone-cases";

/**
 * The database normalises customers' phones itself, in the generated
 * column Booking."customerPhoneE164" — that is how bookings find their
 * account. If it disagreed with src/lib/phone.ts, a customer would sign
 * in and see an empty account. This runs every case through both.
 *
 * Needs a database with prisma/migrations/international_phone.sql
 * applied; skipped unless PHONE_SQL_DATABASE_URL points at a LOCAL one.
 *
 *   PHONE_SQL_DATABASE_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/phone-sql.test.ts
 */
const url = process.env.PHONE_SQL_DATABASE_URL;

describe.skipIf(!url)("maw3ed_normalise_phone() matches normalisePhone()", () => {
  it.each(PHONE_CASES)("%s", async (input) => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ v: string | null }>("select maw3ed_normalise_phone($1) as v", [input]);
      expect(rows[0]?.v).toBe(normalisePhone(input));
    } finally {
      await client.end();
    }
  });
});
