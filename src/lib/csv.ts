/**
 * Rows to a CSV file a person can open.
 *
 * **Quoting is not optional here.** A part called `Filter, pleated 24x24` and a
 * French label carrying a comma both break a naive join, and the failure is
 * silent: the file opens, the columns shift by one, and every row after it is
 * wrong in a way that looks like data rather than like a bug. So every field is
 * quoted and every embedded quote is doubled, which is what RFC 4180 says and
 * what every spreadsheet reads.
 *
 * **CRLF line endings**, for the same reason: Excel on Windows treats a bare
 * newline inside a quoted field as the end of the record.
 */
export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, string | number>[],
): string {
  const cell = (value: string | number | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  return [
    columns.map(cell).join(","),
    ...rows.map((row) => columns.map((column) => cell(row[column])).join(",")),
  ].join("\r\n");
}

/**
 * The bytes to download, with a byte-order mark.
 *
 * Without the BOM, Excel reads a UTF-8 file as the system's legacy encoding and
 * `Procédure` arrives as `ProcÃ©dure`. A bilingual product that exports mojibake
 * to half its users has not exported anything. The mark costs three bytes and
 * every other reader ignores it.
 */
export function csvBlob(text: string): Blob {
  return new Blob([`﻿${text}`], {
    type: "text/csv;charset=utf-8",
  });
}
