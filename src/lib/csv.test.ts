import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("writing a CSV", () => {
  it("writes the header and the rows in column order", () => {
    const csv = toCsv(
      ["site", "raised"],
      [
        { site: "KGN", raised: 12 },
        { site: "REG", raised: 3 },
      ],
    );

    expect(csv).toBe('"site","raised"\r\n"KGN","12"\r\n"REG","3"');
  });

  it("survives a comma, a quote and a newline inside a value", () => {
    /*
     * The failure this prevents is silent, which is why it is tested rather
     * than assumed: an unquoted comma shifts every column after it by one, the
     * file still opens, and the result reads as bad data rather than as a bug.
     */
    const csv = toCsv(
      ["name"],
      [{ name: 'Filter, pleated 24x24 "MERV 13"\nsecond line' }],
    );

    expect(csv).toBe(
      '"name"\r\n"Filter, pleated 24x24 ""MERV 13""\nsecond line"',
    );
  });

  it("writes an empty cell for a column a row does not carry", () => {
    // Absence is an empty cell, not the string "undefined" — which is what a
    // bare template would have written into the file.
    const csv = toCsv(["a", "b"], [{ a: "x" }]);
    expect(csv).toBe('"a","b"\r\n"x",""');
  });

  it("writes a header even when there are no rows", () => {
    // A file with no header is a file a spreadsheet cannot label. An empty
    // report is still a report: it says there is nothing, with columns.
    expect(toCsv(["a", "b"], [])).toBe('"a","b"');
  });
});
