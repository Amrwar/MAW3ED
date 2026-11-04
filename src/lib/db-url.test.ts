import { describe, expect, it } from "vitest";
import { withoutChannelBinding } from "./db-url";

describe("the connection string the Neon adapter gets", () => {
  it("drops channel_binding wherever it sits, keeping the database and sslmode", () => {
    for (const url of [
      "postgresql://u:p@ep-x.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
      "postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ]) {
      const u = new URL(withoutChannelBinding(url));
      expect(u.pathname).toBe("/neondb");
      expect(u.searchParams.get("sslmode")).toBe("require");
      expect(u.searchParams.has("channel_binding")).toBe(false);
    }
  });
  it("leaves anything else as it was", () => {
    expect(withoutChannelBinding("postgresql://qa:qa@localhost:5450/maw3ed_qa")).toBe("postgresql://qa:qa@localhost:5450/maw3ed_qa");
    expect(withoutChannelBinding("")).toBe("");
  });
});
