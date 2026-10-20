import path from "node:path";
import readXlsxFile from "read-excel-file/node";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { CREW_CODE_ASSIGNMENTS } from "@/data/seed/people";
import { SITE_CODES } from "@/domain/types";
import {
  sheetKindFor,
  suggestMapping,
  unmappedFields,
  type ColumnMapping,
  type SheetKind,
} from "./mapping";
import {
  issuesByCode,
  validateImport,
  type SheetData,
  type ValidationContext,
} from "./validate";

/**
 * The validation report, run against the real fixture.
 *
 * This is the claim the whole ticket rests on: the twelve defects the data
 * dictionary documents are the twelve the import wizard finds, at the rows it
 * says, and it finds no thirteenth. Testing the validators against rows written
 * in this file would prove only that the validators agree with themselves — so
 * the input is the committed workbook a reviewer can open.
 */

const FIXTURE = path.resolve(
  import.meta.dirname,
  "../../../tests/fixtures/mp2-export-sample.xlsx",
);

type WorkbookSheet = { sheet: string; data: unknown[][] };
// `getSheets` is in the library's runtime API and not in its `Options` type.
const readWorkbook = readXlsxFile as unknown as (
  file: string,
  options: { getSheets: true },
) => Promise<WorkbookSheet[]>;

let sheets: SheetData[] = [];
let mappings: Record<SheetKind, ColumnMapping>;
let context: ValidationContext;

beforeAll(async () => {
  const workbook = await readWorkbook(FIXTURE, { getSheets: true });

  sheets = workbook.map((entry) => {
    const [header = [], ...rows] = entry.data;
    const kind = sheetKindFor(entry.sheet);
    if (!kind) throw new Error(`Unrecognised sheet: ${entry.sheet}`);
    return { kind, headers: header.map(String), rows };
  });

  mappings = {
    equipment: {},
    inventory: {},
    workOrders: {},
  };
  for (const sheet of sheets) {
    // The two columns a person maps by hand are filled in here, because this
    // test is about validation, not about the mapping step.
    mappings[sheet.kind] = {
      ...suggestMapping(sheet.kind, sheet.headers),
      ...(sheet.kind === "equipment" ? { criticality: "CRITICALITY" } : {}),
      ...(sheet.kind === "inventory" ? { reorderPoint: "MIN_QTY" } : {}),
    };
  }

  const seed = buildSeed(new Date());
  context = {
    today: new Date().toISOString().slice(0, 10),
    knownSiteCodes: [...SITE_CODES],
    knownLocationCodes: seed.locations.map((location) => location.code),
    knownBinCodes: seed.inventoryLocations.map((bin) => bin.code),
    knownCrewCodes: Object.keys(CREW_CODE_ASSIGNMENTS),
    existingAssetTags: seed.assets.map((asset) => asset.assetTag),
    existingPartNumbers: seed.parts.map((part) => part.partNumber),
    existingWorkOrderNumbers: seed.workOrders.map((order) => order.number),
  };
});

describe("reading the fixture's sheets", () => {
  it("recognises all three tabs by name", () => {
    expect(sheets.map((sheet) => sheet.kind)).toEqual([
      "equipment",
      "inventory",
      "workOrders",
    ]);
  });

  it("leaves exactly the two columns a person has to place", () => {
    // Not a contrivance for the demonstration: MP2 installations spell these
    // two differently from site to site, so an alias table built from common
    // exports genuinely does not cover them.
    const equipment = sheets.find((sheet) => sheet.kind === "equipment")!;
    const inventory = sheets.find((sheet) => sheet.kind === "inventory")!;
    expect(
      unmappedFields(
        "equipment",
        suggestMapping("equipment", equipment.headers),
      ),
    ).toEqual(["criticality"]);
    expect(
      unmappedFields(
        "inventory",
        suggestMapping("inventory", inventory.headers),
      ),
    ).toEqual(["reorderPoint"]);
  });

  it("would notice if the suggestion had stopped working", () => {
    // The control for the two assertions above: if `suggestMapping` returned
    // nothing at all, "exactly two unmapped" would be false but a laxer check
    // would have passed. This proves the rest really are placed.
    const equipment = sheets.find((sheet) => sheet.kind === "equipment")!;
    const mapping = suggestMapping("equipment", equipment.headers);
    expect(mapping.assetTag).toBe("EQUIP_NO");
    expect(mapping.locationCode).toBe("LOCATION");
    expect(Object.keys(mapping).length).toBeGreaterThan(6);
  });
});

describe("the validation report on the fixture", () => {
  it("finds the twelve planted defects and nothing else", () => {
    const { issues } = validateImport(sheets, mappings, context);

    // The two rulings are separate from the twelve: they are facts about the
    // source data the report states, not defects planted in it.
    const planted = issues.filter(
      (issue) =>
        issue.code !== "cancelledWithoutReason" &&
        issue.code !== "unmatchedCrewCode",
    );

    expect(issuesByCode(planted)).toEqual({
      duplicateKey: 2, // D1, D2
      unknownAsset: 3, // D3, D4, D5
      unreadableDate: 2, // D6, D7
      completedInFuture: 1, // D8
      negativeQuantity: 1, // D9
      missingRequired: 1, // D10
      unknownSite: 1, // D11
      notANumber: 1, // D12
    });
    expect(planted).toHaveLength(12);
  });

  it("puts each one at the row the data dictionary names", () => {
    const { issues } = validateImport(sheets, mappings, context);
    const at = (code: string) =>
      issues
        .filter((issue) => issue.code === code)
        .map((issue) => `${issue.sheet}:${issue.row}`)
        .sort();

    expect(at("duplicateKey")).toEqual(["equipment:19", "equipment:54"]);
    expect(at("unknownAsset")).toEqual([
      "workOrders:101",
      "workOrders:23",
      "workOrders:58",
    ]);
    expect(at("unreadableDate")).toEqual(["equipment:33", "workOrders:44"]);
    expect(at("completedInFuture")).toEqual(["workOrders:76"]);
    expect(at("negativeQuantity")).toEqual(["inventory:12"]);
    expect(at("missingRequired")).toEqual(["equipment:47"]);
    expect(at("unknownSite")).toEqual(["equipment:62"]);
    expect(at("notANumber")).toEqual(["inventory:27"]);
  });

  it("would notice a defect it had stopped finding", () => {
    // The control. Every assertion above is a comparison against a list; if
    // the validators returned nothing, `issuesByCode` would be `{}` and only
    // the exact-equality assertions would catch it. This removes a defect from
    // the input and watches the report shrink by exactly one.
    const repaired = sheets.map((sheet) =>
      sheet.kind !== "inventory"
        ? sheet
        : {
            ...sheet,
            rows: sheet.rows.map((row, index) => {
              if (index + 2 !== 12) return row;
              const copy = [...row];
              copy[sheet.headers.indexOf("QTY_ON_HAND")] = 6;
              return copy;
            }),
          },
    );

    const before = validateImport(sheets, mappings, context).issues.length;
    const after = validateImport(repaired, mappings, context).issues.length;
    expect(after).toBe(before - 1);
  });

  it("blocks only the rows that cannot become records", () => {
    const { blocked } = validateImport(sheets, mappings, context);
    // A missing name, an unknown site, an asset that is not there: those rows
    // have nowhere to go. A malformed date or a negative count still imports,
    // and the report says so.
    expect(blocked).toEqual({ equipment: 2, inventory: 0, workOrders: 3 });
  });

  it("states the cancelled orders that carry no reason", () => {
    const { issues } = validateImport(sheets, mappings, context);
    const cancelled = issues
      .filter((issue) => issue.code === "cancelledWithoutReason")
      .map((issue) => issue.row)
      .sort((a, b) => a - b);

    // The source has no reason column at all, so every cancelled row is listed
    // rather than one being invented for it.
    expect(cancelled).toEqual([19, 28, 33, 118, 120]);
  });

  it("matches every crew code in the fixture to a person", () => {
    const { issues } = validateImport(sheets, mappings, context);
    expect(
      issues.filter((issue) => issue.code === "unmatchedCrewCode"),
    ).toEqual([]);
  });

  it("would notice a crew code it could not place", () => {
    // The control for the assertion above, which would otherwise pass on an
    // importer that had stopped checking crew codes altogether.
    const withStranger = sheets.map((sheet) =>
      sheet.kind !== "workOrders"
        ? sheet
        : {
            ...sheet,
            rows: sheet.rows.map((row, index) => {
              if (index !== 0) return row;
              const copy = [...row];
              copy[sheet.headers.indexOf("ASSIGNED_TO")] = "NOBODY01";
              return copy;
            }),
          },
    );

    const issues = validateImport(withStranger, mappings, context).issues;
    const unmatched = issues.filter(
      (issue) => issue.code === "unmatchedCrewCode",
    );
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]?.params.code).toBe("NOBODY01");
    // And it is recoverable: the order still imports, unassigned.
    expect(unmatched[0]?.severity).toBe("recoverable");
  });
});
