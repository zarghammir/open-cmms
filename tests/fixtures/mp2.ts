import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads the MP2 import fixture so tests can compare the seed against it.
 *
 * The fixture is the contract between the seed (WA-26) and the import wizard
 * (WA-17): the codes in one have to exist in the other. Comparing against the
 * committed file rather than against a copied list is the point — a copy would
 * drift and nothing would say so.
 */

const FIXTURE_DIR = path.resolve(import.meta.dirname);

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, commas inside them. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readSheet(file: string): Record<string, string>[] {
  const rows = parseCsv(readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
  const header = rows[0] ?? [];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((column, index) => {
      record[column] = row[index] ?? "";
    });
    return record;
  });
}

export const fixtureEquipment = () =>
  readSheet("mp2-export-sample-equipment.csv");
export const fixtureInventory = () =>
  readSheet("mp2-export-sample-inventory.csv");
export const fixtureWorkOrders = () =>
  readSheet("mp2-export-sample-workorders.csv");
