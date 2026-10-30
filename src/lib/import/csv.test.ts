import { describe, it, expect } from "vitest";
import { parseCsv, planCustomers, planServices, MAX_ROWS } from "./csv";

describe("parseCsv", () => {
  it("handles a BOM, CRLF, quoted commas and doubled quotes", () => {
    const rows = parseCsv('﻿name,notes\r\n"Ali, Jr","said ""hi"""\r\n');
    expect(rows).toEqual([["name", "notes"], ["Ali, Jr", 'said "hi"']]);
  });
  it("reads semicolon files from Arabic-locale Excel", () => {
    expect(parseCsv("name;phone\nA;010")).toEqual([["name", "phone"], ["A", "010"]]);
  });
});

describe("planCustomers", () => {
  it("accepts Arabic headers and Arabic-Indic digits", () => {
    const p = planCustomers("الاسم,الموبايل\nأحمد,٠١٠١٢٣٤٥٦٧٨\n", new Set());
    expect(p.errors).toEqual([]);
    expect(p.rows).toEqual([{ line: 2, name: "أحمد", phone: "01012345678", email: null, notes: null }]);
  });
  it("reports bad rows by line and keeps the good ones", () => {
    const p = planCustomers("name,phone,email\nA,0101234567,\n,01012345678,\nB,01012345678,not-an-email\nC,01112345678,c@x.co\n", new Set());
    expect(p.errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(p.rows.map((r) => r.name)).toEqual(["C"]);
  });
  it("finds duplicates in the file and against existing customers, however the number is typed", () => {
    const p = planCustomers("name,phone\nA,01012345678\nB,+20 10 1234 5678\nC,01112345678\n", new Set(["201112345678"]));
    expect(p.rows.map((r) => r.name)).toEqual(["A"]);
    expect(p.duplicates).toEqual([
      { line: 3, where: "file", value: "+20 10 1234 5678" },
      { line: 4, where: "existing", value: "01112345678" },
    ]);
  });
  it("refuses a file without the required columns", () => {
    const p = planCustomers("first,last\nA,B\n", new Set());
    expect(p.rows).toEqual([]);
    expect(p.errors[0].line).toBe(1);
  });
  it("refuses more rows than the cap", () => {
    const body = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `N${i},010${String(10000000 + i)}`).join("\n");
    const p = planCustomers(`name,phone\n${body}`, new Set());
    expect(p.rows).toEqual([]);
    expect(p.errors).toHaveLength(1);
  });
  it("skips blank lines", () => {
    const p = planCustomers("name,phone\n\nA,01012345678\n,\n", new Set());
    expect(p.total).toBe(1);
    expect(p.rows).toHaveLength(1);
  });
});

describe("planServices", () => {
  it("validates duration and price and catches duplicates", () => {
    const p = planServices(
      "الخدمة,المدة,السعر\nقص,30,120\nذقن,3,50\nصبغة,60,-1\nقص,30,100\nسشوار,٤٥,1,250.50\nعناية,40,90\n",
      new Set(["عناية"]),
    );
    expect(p.rows.map((r) => r.nameAr)).toEqual(["قص"]);
    expect(p.errors.map((e) => e.line)).toEqual([3, 4, 6]);
    expect(p.duplicates.map((d) => [d.line, d.where])).toEqual([[5, "file"], [7, "existing"]]);
  });
  it("accepts a quoted price with a thousands separator", () => {
    const p = planServices('name,duration,price\nVIP,90,"1,250.50"\n', new Set());
    expect(p.rows[0]).toMatchObject({ duration: 90, price: 1250.5 });
  });
});
