import path from "node:path";
import readXlsxFile from "read-excel-file/node";
import { beforeAll, describe, expect, it } from "vitest";
import { createImportRepository } from "@/data/repositories/import";
import type { RepositoryContext } from "@/data/repositories/types";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  CREW_CODE_ASSIGNMENTS,
  assignmentForCrewCode,
} from "@/data/seed/people";
import { SITE_CODES } from "@/domain/types";
import { applyMutation, applyMutations, type Actor } from "@/stores/mutations";
import type { BuildContext } from "./build";
import {
  sheetKindFor,
  suggestMapping,
  type ColumnMapping,
  type SheetKind,
} from "./mapping";
import { recordCount, runImport } from "./run";
import type { SheetData, ValidationContext } from "./validate";

/**
 * The number on the report is the number that gets written.
 *
 * A wizard that validated for the report and then built again for the commit
 * could show one figure and write another, and nothing would fail: both passes
 * would be individually correct. A person would approve a screen saying 237
 * records and get some other number of them.
 *
 * So there is one run, and this holds the two ends of it together — the count
 * the screen shows against the records that actually reach the store.
 */

const FIXTURE = path.resolve(
  import.meta.dirname,
  "../../../tests/fixtures/mp2-export-sample.xlsx",
);
const NOW = new Date("2026-09-13T14:05:00.000Z");
const ACTOR: Actor = { userId: "usr-fortin", role: "administrator" };

type WorkbookSheet = { sheet: string; data: unknown[][] };
const readWorkbook = readXlsxFile as unknown as (
  file: string,
  options: { getSheets: true },
) => Promise<WorkbookSheet[]>;

let sheets: SheetData[] = [];
let mappings: Record<SheetKind, ColumnMapping>;

function harness(seed: DemoData) {
  let data = seed;
  let sequence = 0;
  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      sequence += 1;
      data = applyMutation(
        data,
        mutation,
        at ?? NOW.toISOString(),
        `a-${sequence}`,
      );
    },
    commitMany(mutations, audit, actor, entityId, at) {
      sequence += 1;
      data = applyMutations(
        data,
        mutations,
        audit,
        actor,
        entityId,
        at ?? NOW.toISOString(),
        `a-${sequence}`,
      );
    },
    now: () => NOW,
  };
  return {
    repository: createImportRepository(context),
    get data() {
      return data;
    },
  };
}

function contextsFor(seed: DemoData): {
  validation: ValidationContext;
  build: BuildContext;
} {
  return {
    validation: {
      today: "2026-09-13",
      knownSiteCodes: [...SITE_CODES],
      knownLocationCodes: seed.locations.map((l) => l.code),
      knownBinCodes: seed.inventoryLocations.map((b) => b.code),
      knownCrewCodes: Object.keys(CREW_CODE_ASSIGNMENTS),
      existingAssetTags: seed.assets.map((a) => a.assetTag),
      existingPartNumbers: seed.parts.map((p) => p.partNumber),
      existingWorkOrderNumbers: seed.workOrders.map((w) => w.number),
    },
    build: {
      organizationId: seed.organization.id,
      facilityIdForSite: (site) =>
        seed.facilities.find((f) => f.code === site)?.id,
      locationIdForCode: (code) =>
        seed.locations.find((l) => l.code === code)?.id,
      binIdForCode: (code) =>
        seed.inventoryLocations.find((b) => b.code === code)?.id,
      assetTypeIdForPrefix: (prefix) =>
        seed.assetTypes.find((t) => t.tagPrefix === prefix)?.id,
      userIdForCrewCode: (code) => {
        const found = assignmentForCrewCode(code);
        return found && "userId" in found ? found.userId : undefined;
      },
      actorUserId: ACTOR.userId,
      assetIdForTag: (tag) => seed.assets.find((a) => a.assetTag === tag)?.id,
      now: NOW.toISOString(),
    },
  };
}

beforeAll(async () => {
  const workbook = await readWorkbook(FIXTURE, { getSheets: true });
  sheets = workbook.map((entry) => {
    const [header = [], ...rows] = entry.data;
    const kind = sheetKindFor(entry.sheet);
    if (!kind) throw new Error(`Unrecognised sheet: ${entry.sheet}`);
    return { kind, headers: header.map(String), rows };
  });
  mappings = { equipment: {}, inventory: {}, workOrders: {} };
  for (const sheet of sheets) {
    mappings[sheet.kind] = {
      ...suggestMapping(sheet.kind, sheet.headers),
      ...(sheet.kind === "equipment" ? { criticality: "CRITICALITY" } : {}),
      ...(sheet.kind === "inventory" ? { reorderPoint: "MIN_QTY" } : {}),
    };
  }
});

describe("one run, one answer", () => {
  it("commits exactly as many records as the report said it would", () => {
    const seed = buildSeed(NOW);
    const { validation, build } = contextsFor(seed);
    const run = runImport(sheets, mappings, validation, build);
    const test = harness(seed);

    const before =
      seed.assets.length +
      seed.parts.length +
      seed.workOrders.length +
      seed.workOrderAssignments.length;

    test.repository.commitImport(run.records, "mp2-export-sample.xlsx", ACTOR);

    const after =
      test.data.assets.length +
      test.data.parts.length +
      test.data.workOrders.length +
      test.data.workOrderAssignments.length;

    // The number on the screen, and the number that reached the store.
    expect(after - before).toBe(run.counts.total);
    expect(recordCount(run.records)).toBe(run.counts.total);
  });

  it("would notice a count that had drifted from the records", () => {
    // The control. The assertion above compares a count to a difference, and
    // both would be zero on a run that produced nothing. This proves the run
    // actually built records in every collection it claims.
    const seed = buildSeed(NOW);
    const { validation, build } = contextsFor(seed);
    const run = runImport(sheets, mappings, validation, build);

    expect(run.counts.total).toBeGreaterThan(200);
    expect(run.counts.assets).toBeGreaterThan(0);
    expect(run.counts.parts).toBeGreaterThan(0);
    expect(run.counts.workOrders).toBeGreaterThan(0);
    expect(run.counts.assignments).toBeGreaterThan(0);
    expect(run.counts.total).toBe(
      run.counts.assets +
        run.counts.parts +
        run.counts.workOrders +
        run.counts.assignments,
    );
  });

  it("counts blocked rows as rows kept out, not as records written", () => {
    const seed = buildSeed(NOW);
    const { validation, build } = contextsFor(seed);
    const run = runImport(sheets, mappings, validation, build);

    // Two equipment rows and three work orders cannot become records.
    expect(run.counts.blocked).toEqual({
      equipment: 2,
      inventory: 0,
      workOrders: 3,
    });
    // 80 rows, less the two a blocking issue keeps out, less the two that
    // duplicate a tag already arriving — a duplicate key is one asset entered
    // twice, and the records are not the place to hold both.
    expect(run.counts.assets).toBe(76);
    expect(run.counts.blocked.equipment + run.counts.assets).toBe(78);
  });

  it("gives the report the same issues the build was told about", () => {
    const seed = buildSeed(NOW);
    const { validation, build } = contextsFor(seed);
    const run = runImport(sheets, mappings, validation, build);

    // Twelve planted defects plus the five cancelled orders the source has no
    // reason for. One run produced both the list and the records.
    const planted = run.issues.filter(
      (issue) =>
        issue.code !== "cancelledWithoutReason" &&
        issue.code !== "unmatchedCrewCode",
    );
    expect(planted).toHaveLength(12);
    expect(run.counts.byCode.cancelledWithoutReason).toBe(5);
    expect(run.counts.rowsWithIssues).toBe(
      new Set(run.issues.map((i) => `${i.sheet}:${i.row}`)).size,
    );
  });

  it("imports an order whose crew nobody employs, unassigned and saying so", () => {
    const seed = buildSeed(NOW);
    const { validation, build } = contextsFor(seed);
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

    const run = runImport(withStranger, mappings, validation, build);

    const reported = run.issues.filter(
      (issue) => issue.code === "unmatchedCrewCode",
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]?.params.code).toBe("NOBODY01");

    // The order still arrives, with nobody on it and the source's own code kept
    // rather than a person invented to fill the column.
    const assignment = run.records.workOrderAssignments.find(
      (row) => row.crewCode === "NOBODY01",
    );
    expect(assignment).toBeDefined();
    expect(assignment?.userId).toBeNull();
    expect(
      run.records.workOrders.some((o) => o.id === assignment?.workOrderId),
    ).toBe(true);
  });
});
