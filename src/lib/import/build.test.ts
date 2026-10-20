import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { assignmentForCrewCode } from "@/data/seed/people";
import { buildRecords, type BuildContext } from "./build";
import type { ColumnMapping, SheetKind } from "./mapping";
import type { SheetData } from "./validate";

/**
 * What an imported assignment actually carries.
 *
 * The rule is that a crew code nobody holds imports the order **unassigned**,
 * keeping the source's own code rather than inventing a person for it. Until
 * now that rule was asserted at the report — which says a code was unmatched —
 * and nowhere at the record. A report can be right about a row while the record
 * written from it is wrong, and those are two different claims.
 */

const NOW = "2026-09-13T14:05:00.000Z";
const seed = buildSeed(new Date(NOW));

const HEADERS = [
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
] as const;

const MAPPING: ColumnMapping = {
  number: "WO_NO",
  assetTag: "EQUIP_NO",
  type: "WO_TYPE",
  priority: "PRIORITY",
  requestedAt: "DATE_REQUESTED",
  dueAt: "DATE_DUE",
  completedAt: "DATE_COMPLETED",
  status: "STATUS",
  crewCode: "ASSIGNED_TO",
  description: "DESCRIPTION",
};

/** An asset the seed already holds, so the order has something to hang on. */
const EXISTING = seed.assets[0]!;

function orderRowWithCrew(crewCode: string): SheetData[] {
  return [
    {
      kind: "workOrders",
      headers: [...HEADERS],
      rows: [
        [
          "WO-900001",
          EXISTING.assetTag,
          "PM",
          3,
          "2026-08-01",
          "2026-09-30",
          null,
          "OPEN",
          crewCode,
          "Quarterly preventive maintenance",
        ],
      ],
    },
  ];
}

const MAPPINGS: Record<SheetKind, ColumnMapping> = {
  equipment: {},
  inventory: {},
  workOrders: MAPPING,
};

const CONTEXT: BuildContext = {
  organizationId: seed.organization.id,
  facilityIdForSite: (site) => seed.facilities.find((f) => f.code === site)?.id,
  locationIdForCode: (code) => seed.locations.find((l) => l.code === code)?.id,
  binIdForCode: (code) =>
    seed.inventoryLocations.find((b) => b.code === code)?.id,
  assetTypeIdForPrefix: (prefix) =>
    seed.assetTypes.find((t) => t.tagPrefix === prefix)?.id,
  userIdForCrewCode: (code) => {
    const found = assignmentForCrewCode(code);
    return found && "userId" in found ? found.userId : undefined;
  },
  actorUserId: "usr-fortin",
  assetIdForTag: (tag) => seed.assets.find((a) => a.assetTag === tag)?.id,
  now: NOW,
};

describe("the assignment an imported order arrives with", () => {
  it("carries no user and the source's own code when nobody holds it", () => {
    const built = buildRecords(
      orderRowWithCrew("NOBODY01"),
      MAPPINGS,
      [],
      CONTEXT,
    );

    expect(built.workOrders).toHaveLength(1);
    expect(built.workOrderAssignments).toHaveLength(1);

    const assignment = built.workOrderAssignments[0]!;
    // Unassigned, and not silently: the code the export carried is kept, so a
    // person can ask who "NOBODY01" was meant to be.
    expect(assignment.userId).toBeNull();
    expect(assignment.crewCode).toBe("NOBODY01");
    expect(assignment.workOrderId).toBe(built.workOrders[0]!.id);
    expect(assignment.assignedByUserId).toBe("usr-fortin");
  });

  it("resolves a code the organisation does hold to that person", () => {
    // The control. "userId is null" passes just as happily on a builder that
    // never resolves anybody, so this is the same row with a code that should
    // resolve — and it must come back with a real user.
    const known = "TECH01";
    const expected = assignmentForCrewCode(known);
    expect(expected, "the seed must hold this crew code").toBeDefined();

    const built = buildRecords(orderRowWithCrew(known), MAPPINGS, [], CONTEXT);
    const assignment = built.workOrderAssignments[0]!;

    expect(assignment.userId).not.toBeNull();
    expect(assignment.crewCode).toBe(known);
    expect(seed.users.some((user) => user.id === assignment.userId)).toBe(true);
  });

  it("writes no assignment at all when the column is empty", () => {
    // Three states again: a code nobody holds and no code given are different,
    // and neither is a person.
    const built = buildRecords(orderRowWithCrew(""), MAPPINGS, [], CONTEXT);

    expect(built.workOrders).toHaveLength(1);
    expect(built.workOrderAssignments).toEqual([]);
  });
});
