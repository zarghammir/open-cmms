/**
 * Reading one cell.
 *
 * Three answers, never two. A cell can be **absent** (nothing was typed), hold
 * a **value**, or be **unreadable** (something was typed and it is not what the
 * column is for). Collapsing the last two into "no value" is how a spreadsheet
 * full of `12/24/2025` imports as a spreadsheet full of blank dates and nobody
 * is told — the same shape as an empty result standing in for a failed lookup.
 */

export type CellReading<T> =
  | { kind: "absent" }
  | { kind: "value"; value: T }
  | { kind: "unreadable"; raw: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The raw cell as trimmed text, or absent. */
export function readText(cell: unknown): CellReading<string> {
  if (cell === null || cell === undefined) return { kind: "absent" };
  const text = String(cell).trim();
  return text === "" ? { kind: "absent" } : { kind: "value", value: text };
}

/**
 * A calendar day.
 *
 * Only `YYYY-MM-DD` is a value. `12/24/2025` is **unreadable**, not absent and
 * not a date: read as month-first it is one day, read as day-first it is
 * another, and an importer that picks one is inventing a fact about equipment
 * maintenance. The person is asked instead.
 */
export function readIsoDate(cell: unknown): CellReading<string> {
  const text = readText(cell);
  if (text.kind !== "value") return text;

  const raw = text.value;
  if (!ISO_DATE.test(raw)) return { kind: "unreadable", raw };

  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { kind: "unreadable", raw };
  // Rejects 2026-02-31, which `Date` would roll forward into March.
  return parsed.toISOString().slice(0, 10) === raw
    ? { kind: "value", value: raw }
    : { kind: "unreadable", raw };
}

/** A whole number. Text that is not one is unreadable, not zero. */
export function readInteger(cell: unknown): CellReading<number> {
  if (typeof cell === "number") {
    return Number.isInteger(cell)
      ? { kind: "value", value: cell }
      : { kind: "unreadable", raw: String(cell) };
  }
  const text = readText(cell);
  if (text.kind !== "value") return text;
  const value = Number(text.value);
  return Number.isInteger(value)
    ? { kind: "value", value }
    : { kind: "unreadable", raw: text.value };
}

/** An amount of money or a measure. `"N/A"` is unreadable, never 0. */
export function readDecimal(cell: unknown): CellReading<number> {
  if (typeof cell === "number") {
    return Number.isFinite(cell)
      ? { kind: "value", value: cell }
      : { kind: "unreadable", raw: String(cell) };
  }
  const text = readText(cell);
  if (text.kind !== "value") return text;
  const value = Number(text.value);
  return Number.isFinite(value)
    ? { kind: "value", value }
    : { kind: "unreadable", raw: text.value };
}

/** An uppercased code — status, criticality, a crew code. */
export function readCode(cell: unknown): CellReading<string> {
  const text = readText(cell);
  return text.kind === "value"
    ? { kind: "value", value: text.value.toUpperCase() }
    : text;
}

/** The site a location or bin code belongs to: `KGN` in `KGN-B02-219`. */
export function siteOf(code: string): string {
  return code.split("-")[0]?.toUpperCase() ?? "";
}
