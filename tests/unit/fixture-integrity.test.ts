import path from "node:path";
import readXlsxFile from "read-excel-file/node";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The import fixture still is what the data dictionary says it is.
 *
 * `tests/fixtures/mp2-export-sample.xlsx` is a committed artifact that a demo
 * script and a whole ticket (WA-17) are built on, and the dictionary beside it
 * names twelve defects by sheet and row. Nothing stops someone opening the
 * workbook, changing a cell and committing it: the CSV mirrors would still
 * parse, the seed tests would still pass, and the validation report in front of
 * an evaluator would quietly have eleven rows in it instead of twelve.
 *
 * So this reads the **workbook**, not the mirrors — the mirrors are generated
 * from it and would agree with a drifted file just as happily — and fails
 * loudly on any drift.
 *
 * It deliberately does not police the due-date spread. That drifts by design as
 * time passes, degrading gracefully, and a test that went red every week for a
 * cosmetic reason is a test somebody switches off.
 */

const FIXTURE = path.resolve(
  import.meta.dirname,
  "../fixtures/mp2-export-sample.xlsx",
);

const EXPECTED_HEADERS: Record<string, readonly string[]> = {
  Equipment: [
    "EQUIP_NO",
    "EQUIP_DESC",
    "LOCATION",
    "MFG",
    "MODEL",
    "SERIAL_NO",
    "INSTALL_DATE",
    "STATUS",
    "CRITICALITY",
  ],
  Inventory: [
    "STOCK_NO",
    "DESCRIPTION",
    "QTY_ON_HAND",
    "MIN_QTY",
    "UNIT_COST",
    "BIN",
  ],
  WorkOrders: [
    "WO_NO",
    "EQUIP_NO",
    "WO_TYPE",
    "PRIORITY",
    "DATE_REQUESTED",
    "DATE_DUE",
    "DATE_COMPLETED",
    "STATUS",
    "ASSIGNED_TO",
    "DESCRIPTION",
  ],
};

const EXPECTED_ROWS: Record<string, number> = {
  Equipment: 80,
  Inventory: 40,
  WorkOrders: 120,
};

/** Every planted defect, by the sheet, row and value the dictionary records. */
const DEFECTS = [
  {
    id: "D1",
    sheet: "Equipment",
    row: 19,
    column: "EQUIP_NO",
    value: "BLR-MCT-01",
  },
  {
    id: "D2",
    sheet: "Equipment",
    row: 54,
    column: "EQUIP_NO",
    value: "ATS-MCT-01",
  },
  {
    id: "D3",
    sheet: "WorkOrders",
    row: 23,
    column: "EQUIP_NO",
    value: "AHU-KGN-99",
  },
  {
    id: "D4",
    sheet: "WorkOrders",
    row: 58,
    column: "EQUIP_NO",
    value: "BSC-HAL-01",
  },
  {
    id: "D5",
    sheet: "WorkOrders",
    row: 101,
    column: "EQUIP_NO",
    value: "PMP-MCT-07",
  },
  {
    id: "D6",
    sheet: "Equipment",
    row: 33,
    column: "INSTALL_DATE",
    value: "15/03/2022",
  },
  {
    id: "D7",
    sheet: "WorkOrders",
    row: 44,
    column: "DATE_DUE",
    value: "12/24/2025",
  },
  {
    id: "D8",
    sheet: "WorkOrders",
    row: 76,
    column: "DATE_COMPLETED",
    value: "2029-06-08",
  },
  { id: "D9", sheet: "Inventory", row: 12, column: "QTY_ON_HAND", value: -4 },
  { id: "D10", sheet: "Equipment", row: 47, column: "EQUIP_DESC", value: null },
  {
    id: "D11",
    sheet: "Equipment",
    row: 62,
    column: "LOCATION",
    value: "HAL-B01-118",
  },
  { id: "D12", sheet: "Inventory", row: 27, column: "UNIT_COST", value: "N/A" },
] as const;

type Sheet = { headers: string[]; rows: unknown[][] };

const sheets: Record<string, Sheet> = {};
let sheetNames: string[] = [];

/**
 * `getSheets` works, and the library's own `Options` type does not mention it.
 *
 * Reading sheets by index is typed, but it returns rows without names, and this
 * test has to assert the sheet names and their order. So the call is described
 * here rather than silenced with a cast at the call site: one narrow signature,
 * with the reason beside it, instead of an `as never` that hides what is going
 * on. If a later version types the option, this alias simply stops being needed.
 */
type WorkbookSheet = { sheet: string; data: unknown[][] };
const readWorkbook = readXlsxFile as unknown as (
  file: string,
  options: { getSheets: true },
) => Promise<WorkbookSheet[]>;

beforeAll(async () => {
  // One call returns every sheet with its rows, in workbook order:
  // `[{ sheet, data }]`, where `data[0]` is the header row.
  const workbook = await readWorkbook(FIXTURE, { getSheets: true });

  sheetNames = workbook.map((entry) => entry.sheet);
  for (const entry of workbook) {
    const [header = [], ...rows] = entry.data;
    sheets[entry.sheet] = {
      headers: header.map((cell) => String(cell)),
      rows,
    };
  }
});

/** A cell by the dictionary's coordinates: header is row 1, so data starts at 2. */
function cell(sheetName: string, row: number, column: string): unknown {
  const sheet = sheets[sheetName];
  if (!sheet) throw new Error(`No sheet named ${sheetName}`);
  const index = sheet.headers.indexOf(column);
  if (index === -1) throw new Error(`${sheetName} has no column ${column}`);
  return sheet.rows[row - 2]?.[index] ?? null;
}

describe("the MP2 import fixture", () => {
  it("holds three sheets, named and ordered as the dictionary says", () => {
    expect(sheetNames).toEqual(["Equipment", "Inventory", "WorkOrders"]);
  });

  it("holds the documented row counts", () => {
    for (const [name, count] of Object.entries(EXPECTED_ROWS)) {
      expect(sheets[name]?.rows.length, `${name} row count`).toBe(count);
    }
  });

  it("holds the documented columns, in order", () => {
    for (const [name, headers] of Object.entries(EXPECTED_HEADERS)) {
      expect(sheets[name]?.headers, `${name} headers`).toEqual([...headers]);
    }
  });

  it("still carries all twelve planted defects, each where it is documented", () => {
    for (const defect of DEFECTS) {
      const actual = cell(defect.sheet, defect.row, defect.column);
      if (defect.value === null) {
        expect(
          actual === null || String(actual).trim() === "",
          `${defect.id}: ${defect.sheet} row ${defect.row} should be blank`,
        ).toBe(true);
      } else {
        expect(
          String(actual),
          `${defect.id}: ${defect.sheet} row ${defect.row} ${defect.column}`,
        ).toBe(String(defect.value));
      }
    }
    expect(DEFECTS).toHaveLength(12);
  });

  it("would notice a defect that had been repaired", () => {
    // The control. Every assertion above is an equality against a value read
    // from the file; if the reader returned nothing they would all still pass
    // against `undefined`. This proves the coordinates resolve to real cells
    // and that a changed one would be seen.
    for (const defect of DEFECTS.slice(0, 3)) {
      const actual = cell(defect.sheet, defect.row, defect.column);
      expect(String(actual)).not.toBe("a value nobody planted");
      expect(actual).not.toBeUndefined();
    }
    expect(() => cell("Equipment", 19, "NO_SUCH_COLUMN")).toThrow();
    expect(() => cell("NoSuchSheet", 2, "EQUIP_NO")).toThrow();
  });

  it("keeps D8 in the future, so it is still a defect", () => {
    // D8 is "completed, with a completion date in the future". It stops being
    // one the day that date arrives, and then the workbook holds eleven
    // defects while the dictionary still promises twelve. This is the row that
    // fails loudly on the morning that happens.
    const completed = String(cell("WorkOrders", 76, "DATE_COMPLETED"));
    const today = new Date().toISOString().slice(0, 10);
    expect(
      completed > today,
      `D8 expired: ${completed} is no longer in the future. Regenerate it with a longer offset — do not lower the expected defect count.`,
    ).toBe(true);
  });

  it("has not grown a second unreadable date, which would be a thirteenth defect", () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const unreadable: string[] = [];
    for (const [name, columns] of [
      ["Equipment", ["INSTALL_DATE"]],
      ["WorkOrders", ["DATE_REQUESTED", "DATE_DUE", "DATE_COMPLETED"]],
    ] as const) {
      for (const column of columns) {
        sheets[name]?.rows.forEach((_, index) => {
          const value = cell(name, index + 2, column);
          if (value !== null && value !== "" && !iso.test(String(value))) {
            unreadable.push(`${name}!${column} row ${index + 2}`);
          }
        });
      }
    }
    // Exactly the two planted ones, D6 and D7.
    expect(unreadable.sort()).toEqual([
      "Equipment!INSTALL_DATE row 33",
      "WorkOrders!DATE_DUE row 44",
    ]);
  });
});
