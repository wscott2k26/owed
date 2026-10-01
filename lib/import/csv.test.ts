import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, rowsToObjects } from "./csv";
import { importCsv, validateRow } from "./validate";

const samplePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "sample-invoices.csv",
);

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    invoice_number: "INV-1",
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    customer_phone: "555-0100",
    amount: "100.00",
    due_date: "2026-09-15",
    notes: "",
    ...overrides,
  };
}

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,b,c\n1,"two, too","say ""hi"""\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "two, too", 'say "hi"'],
    ]);
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("skips fully-empty lines", () => {
    const rows = parseCsv("a,b\n\n1,2\n   \n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rowsToObjects trims headers and fills missing cells with empty string", () => {
    const objs = rowsToObjects([
      [" name ", "age"],
      ["Ann", "30"],
      ["Bob"],
    ]);
    expect(objs).toEqual([
      { name: "Ann", age: "30" },
      { name: "Bob", age: "" },
    ]);
  });
});

describe("validateRow", () => {
  it("rejects a bad amount with a clear message", () => {
    const { error } = validateRow(baseRow({ amount: "abc" }));
    expect(error).toBe('invalid amount "abc" — expected a number like 1250.00');
  });

  it("rejects an impossible due_date with a clear message", () => {
    const { error } = validateRow(baseRow({ due_date: "2026-13-99" }));
    expect(error).toBe('invalid due_date "2026-13-99" — expected YYYY-MM-DD');
  });

  it("rejects a missing invoice_number", () => {
    const { error } = validateRow(baseRow({ invoice_number: "" }));
    expect(error).toBe("missing invoice_number");
  });

  it("rejects a malformed customer_email", () => {
    const { error } = validateRow(baseRow({ customer_email: "not-an-email" }));
    expect(error).toBe(
      'invalid customer_email "not-an-email" — expected something like name@example.com',
    );
  });

  it('parses "$1,200.50" to 120050 cents', () => {
    const { record, error } = validateRow(baseRow({ amount: "$1,200.50" }));
    expect(error).toBeUndefined();
    expect(record?.amountCents).toBe(120050);
  });
});

describe("importCsv", () => {
  it("imports the sample CSV: 10 records and 0 errors", () => {
    const text = readFileSync(samplePath, "utf8");
    const { records, errors } = importCsv(text);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(10);
    expect(records[0].number).toBe("INV-1001");
    expect(records[9].number).toBe("INV-1010");
  });

  it("returns one 'empty file' error for empty input", () => {
    const { records, errors } = importCsv("");
    expect(records).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("empty file");
  });

  it("names the expected columns when headers do not match", () => {
    const { records, errors } = importCsv("foo,bar\n1,2\n");
    expect(records).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].message).toContain("invoice_number");
    expect(errors[0].message).toContain("due_date");
  });

  it("collects errors from multiple bad rows with correct line numbers", () => {
    const text =
      "invoice_number,customer_name,customer_email,customer_phone,amount,due_date,notes\n" +
      "INV-1,Jane,jane@example.com,,abc,2026-09-15,\n" +
      ",Bob,,,,,\n";
    const { records, errors } = importCsv(text);
    expect(records).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      line: 2,
      message: 'invalid amount "abc" — expected a number like 1250.00',
    });
    expect(errors[1]).toEqual({ line: 3, message: "missing invoice_number" });
  });
});
