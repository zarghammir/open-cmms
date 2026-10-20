import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  ASSET_TYPE_SEEDS,
  COUNT_NOTES,
  OPENING_COUNTS,
  PART_POOLS,
  PART_SEEDS,
} from "@/data/seed/catalog";
import { CREW_CODE_ASSIGNMENTS } from "@/data/seed/people";
import { UNKNOWN_FIXTURE_SITE } from "@/data/seed/reference";
import { canTransition } from "@/domain/constants/work-order-status";
import { ACCEPTED_MIME_TYPES, DOCUMENT_KINDS } from "@/domain/types";
import {
  fixtureEquipment,
  fixtureInventory,
  fixtureWorkOrders,
} from "../fixtures/mp2";

/**
 * The seed holds together, and it holds together with the import fixture.
 *
 * Two different jobs. The first is ordinary reference integrity: no work order
 * pointing at an asset that is not there. The second is the one that matters
 * to the demo — every room and bin the MP2 export names has to exist here, or
 * the import resolves nothing and WA-17's validation report fills with
 * unknown locations that were never meant to be findings.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

export interface ReferenceReport {
  problems: string[];
  /** How many references were examined. An empty problem list means nothing
   * unless this is large: a checker that looked at nothing reports no
   * problems, which is the failure mode this number exists to catch. */
  checked: number;
}

/**
 * Every reference that does not resolve, as a list of readable problems.
 *
 * Written as a function returning a report rather than a wall of assertions so
 * that the test can delete a record on purpose and prove the check notices.
 */
export function referenceReport(data: DemoData): ReferenceReport {
  const problems: string[] = [];
  let checked = 0;
  const ids = (records: readonly { id: string }[]) =>
    new Set(records.map((record) => record.id));

  const facilityIds = ids(data.facilities);
  const locationIds = ids(data.locations);
  const binIds = ids(data.inventoryLocations);
  const userIds = ids(data.users);
  const assetTypeIds = ids(data.assetTypes);
  const assetIds = ids(data.assets);
  const partIds = ids(data.parts);
  const planIds = ids(data.maintenancePlans);
  const orderIds = ids(data.workOrders);
  const inspectionIds = ids(data.inspections);
  const templateIds = ids(data.inspectionTemplates);
  const templateItemIds = new Set(
    data.inspectionTemplates.flatMap((template) =>
      template.items.map((item) => item.id),
    ),
  );

  const check = (
    condition: boolean,
    where: string,
    id: string,
    field: string,
    value: string | null,
  ) => {
    checked += 1;
    if (!condition) problems.push(`${where} ${id}: ${field} -> ${value}`);
  };

  for (const location of data.locations) {
    check(
      facilityIds.has(location.facilityId),
      "location",
      location.id,
      "facilityId",
      location.facilityId,
    );
    if (location.parentId) {
      check(
        locationIds.has(location.parentId),
        "location",
        location.id,
        "parentId",
        location.parentId,
      );
    }
  }

  for (const user of data.users) {
    check(
      facilityIds.has(user.homeFacilityId),
      "user",
      user.id,
      "homeFacilityId",
      user.homeFacilityId,
    );
  }

  for (const asset of data.assets) {
    check(
      facilityIds.has(asset.facilityId),
      "asset",
      asset.id,
      "facilityId",
      asset.facilityId,
    );
    check(
      locationIds.has(asset.locationId),
      "asset",
      asset.id,
      "locationId",
      asset.locationId,
    );
    check(
      assetTypeIds.has(asset.assetTypeId),
      "asset",
      asset.id,
      "assetTypeId",
      asset.assetTypeId,
    );
  }

  for (const part of data.parts) {
    check(
      facilityIds.has(part.facilityId),
      "part",
      part.id,
      "facilityId",
      part.facilityId,
    );
    check(
      binIds.has(part.inventoryLocationId),
      "part",
      part.id,
      "inventoryLocationId",
      part.inventoryLocationId,
    );
  }

  for (const order of data.workOrders) {
    check(
      assetIds.has(order.assetId),
      "workOrder",
      order.id,
      "assetId",
      order.assetId,
    );
    check(
      facilityIds.has(order.facilityId),
      "workOrder",
      order.id,
      "facilityId",
      order.facilityId,
    );
    check(
      locationIds.has(order.locationId),
      "workOrder",
      order.id,
      "locationId",
      order.locationId,
    );
  }

  for (const task of data.workOrderTasks) {
    check(
      orderIds.has(task.workOrderId),
      "task",
      task.id,
      "workOrderId",
      task.workOrderId,
    );
    if (task.completedByUserId) {
      check(
        userIds.has(task.completedByUserId),
        "task",
        task.id,
        "completedByUserId",
        task.completedByUserId,
      );
    }
  }

  for (const assignment of data.workOrderAssignments) {
    check(
      orderIds.has(assignment.workOrderId),
      "assignment",
      assignment.id,
      "workOrderId",
      assignment.workOrderId,
    );
    check(
      userIds.has(assignment.assignedByUserId),
      "assignment",
      assignment.id,
      "assignedByUserId",
      assignment.assignedByUserId,
    );
    if (assignment.userId) {
      check(
        userIds.has(assignment.userId),
        "assignment",
        assignment.id,
        "userId",
        assignment.userId,
      );
    }
    if (assignment.crewCode) {
      check(
        assignment.crewCode in CREW_CODE_ASSIGNMENTS,
        "assignment",
        assignment.id,
        "crewCode",
        assignment.crewCode,
      );
    }
  }

  for (const entry of data.workOrderStatusHistory) {
    check(
      orderIds.has(entry.workOrderId),
      "history",
      entry.id,
      "workOrderId",
      entry.workOrderId,
    );
    check(
      userIds.has(entry.byUserId),
      "history",
      entry.id,
      "byUserId",
      entry.byUserId,
    );
  }

  for (const schedule of data.maintenanceSchedules) {
    check(
      planIds.has(schedule.planId),
      "schedule",
      schedule.id,
      "planId",
      schedule.planId,
    );
    check(
      assetIds.has(schedule.assetId),
      "schedule",
      schedule.id,
      "assetId",
      schedule.assetId,
    );
  }

  for (const plan of data.maintenancePlans) {
    check(
      assetTypeIds.has(plan.assetTypeId),
      "plan",
      plan.id,
      "assetTypeId",
      plan.assetTypeId,
    );
  }

  for (const template of data.inspectionTemplates) {
    for (const assetTypeId of template.assetTypeIds) {
      check(
        assetTypeIds.has(assetTypeId),
        "template",
        template.id,
        "assetTypeId",
        assetTypeId,
      );
    }
  }

  for (const inspection of data.inspections) {
    check(
      templateIds.has(inspection.templateId),
      "inspection",
      inspection.id,
      "templateId",
      inspection.templateId,
    );
    check(
      assetIds.has(inspection.assetId),
      "inspection",
      inspection.id,
      "assetId",
      inspection.assetId,
    );
    check(
      facilityIds.has(inspection.facilityId),
      "inspection",
      inspection.id,
      "facilityId",
      inspection.facilityId,
    );
    if (inspection.performedByUserId) {
      check(
        userIds.has(inspection.performedByUserId),
        "inspection",
        inspection.id,
        "performedByUserId",
        inspection.performedByUserId,
      );
    }
  }

  for (const result of data.inspectionResults) {
    check(
      inspectionIds.has(result.inspectionId),
      "result",
      result.id,
      "inspectionId",
      result.inspectionId,
    );
    check(
      templateItemIds.has(result.templateItemId),
      "result",
      result.id,
      "templateItemId",
      result.templateItemId,
    );
  }

  for (const finding of data.inspectionFindings) {
    check(
      inspectionIds.has(finding.inspectionId),
      "finding",
      finding.id,
      "inspectionId",
      finding.inspectionId,
    );
    check(
      templateItemIds.has(finding.templateItemId),
      "finding",
      finding.id,
      "templateItemId",
      finding.templateItemId,
    );
  }

  for (const movement of data.inventoryTransactions) {
    check(
      partIds.has(movement.partId),
      "transaction",
      movement.id,
      "partId",
      movement.partId,
    );
    check(
      userIds.has(movement.byUserId),
      "transaction",
      movement.id,
      "byUserId",
      movement.byUserId,
    );
    if (movement.workOrderId) {
      check(
        orderIds.has(movement.workOrderId),
        "transaction",
        movement.id,
        "workOrderId",
        movement.workOrderId,
      );
    }
  }

  for (const document of data.documents) {
    check(
      userIds.has(document.uploadedByUserId),
      "document",
      document.id,
      "uploadedByUserId",
      document.uploadedByUserId,
    );
    if (document.assetId) {
      check(
        assetIds.has(document.assetId),
        "document",
        document.id,
        "assetId",
        document.assetId,
      );
    }
  }

  const subjects: Record<string, Set<string>> = {
    workOrder: orderIds,
    part: partIds,
    inspection: inspectionIds,
    asset: assetIds,
  };
  for (const notification of data.notifications) {
    const pool = subjects[notification.subject.entity];
    check(
      pool !== undefined && pool.has(notification.subject.id),
      "notification",
      notification.id,
      "subject",
      notification.subject.id,
    );
  }

  for (const event of data.auditEvents) {
    // The seed is a record of what people did, so every entry in it names one.
    // Asserted rather than skipped past: a `continue` here would make the
    // check below vacuous the day the seed grew an entry nobody wrote.
    check(
      event.actorKind === "person",
      "audit",
      event.id,
      "actorKind",
      event.actorKind,
    );
    if (event.actorKind !== "person") continue;

    check(
      userIds.has(event.actorUserId),
      "audit",
      event.id,
      "actorUserId",
      event.actorUserId,
    );
  }

  return { problems, checked };
}

describe("the seed", () => {
  const seed = buildSeed(TODAY);

  it("is built at all", () => {
    expect(seed.facilities).toHaveLength(5);
    expect(seed.users).toHaveLength(10);
    expect(seed.assets.length).toBeGreaterThanOrEqual(50);
    expect(seed.workOrders).toHaveLength(40);
    expect(seed.parts).toHaveLength(25);
  });

  it("resolves every reference, and checks a great many of them", () => {
    const report = referenceReport(seed);

    expect(report.problems).toEqual([]);
    // Without this, a checker that examined nothing would report no problems
    // and this test would be a green light for any data at all.
    expect(report.checked).toBeGreaterThan(800);
  });

  it("notices when a reference stops resolving", () => {
    // The deletion control: remove one room and the assets in it are orphaned.
    const withoutARoom: DemoData = {
      ...seed,
      locations: seed.locations.filter(
        (location) => location.id !== seed.assets[0]!.locationId,
      ),
    };
    const report = referenceReport(withoutARoom);

    expect(report.problems.length).toBeGreaterThan(0);
    expect(report.problems.join("\n")).toContain(seed.assets[0]!.locationId);
    expect(report.checked).toBeGreaterThan(800);
  });

  it("contains every room the import fixture points at", () => {
    const codes = new Set(seed.locations.map((location) => location.code));
    const wanted = fixtureEquipment()
      .map((row) => row.LOCATION ?? "")
      .filter((code) => code && !code.startsWith(`${UNKNOWN_FIXTURE_SITE}-`));

    expect(wanted.length).toBe(79);
    expect([...new Set(wanted)].filter((code) => !codes.has(code))).toEqual([]);
  });

  it("does not contain the site that planted defect D11 depends on", () => {
    // D11 is "location refers to a site that is not in the network". If the
    // seed ever grew a HAL site, that row would resolve and the fixture would
    // silently hold eleven defects rather than twelve.
    // Compared as plain strings on purpose. `SiteCode` rules HAL out today, so
    // TypeScript calls the comparison pointless — but the check is about the
    // data, and the day someone widens that type to import a sixth site is
    // exactly the day this has to still be looking.
    expect(
      seed.facilities
        .map((facility) => facility.code as string)
        .filter((code) => code === UNKNOWN_FIXTURE_SITE),
    ).toEqual([]);
    expect(
      seed.locations.filter((location) =>
        location.code.startsWith(`${UNKNOWN_FIXTURE_SITE}-`),
      ),
    ).toEqual([]);
  });

  it("contains every bin the import fixture points at", () => {
    const codes = new Set(seed.inventoryLocations.map((bin) => bin.code));
    const wanted = [
      ...new Set(
        fixtureInventory()
          .map((row) => row.BIN ?? "")
          .filter(Boolean),
      ),
    ];

    expect(wanted.length).toBe(38);
    expect(wanted.filter((code) => !codes.has(code))).toEqual([]);
  });

  it("maps every crew code the import fixture assigns work to", () => {
    // This is the dependency WA-29 flagged and could not close itself: the
    // export assigns work to crew codes, not to people. An unmapped code makes
    // the importer drop the assignment.
    const codes = [
      ...new Set(
        fixtureWorkOrders()
          .map((row) => row.ASSIGNED_TO ?? "")
          .filter(Boolean),
      ),
    ].sort();

    expect(codes.length).toBe(20);
    expect(codes.filter((code) => !(code in CREW_CODE_ASSIGNMENTS))).toEqual(
      [],
    );

    // Every code resolves to a seeded person or to the contractor. Neither is
    // "unassigned", and the importer must be able to tell the three apart.
    const userIds = new Set(seed.users.map((user) => user.id));
    const unresolved = codes.filter((code) => {
      const assignment = CREW_CODE_ASSIGNMENTS[code]!;
      return assignment.kind === "user" && !userIds.has(assignment.userId);
    });
    expect(unresolved).toEqual([]);
    expect(
      codes.filter(
        (code) => CREW_CODE_ASSIGNMENTS[code]!.kind === "contractor",
      ),
    ).toEqual(["CONT01"]);
  });

  it("only walks legal status transitions", () => {
    const byOrder = new Map<string, typeof seed.workOrderStatusHistory>();
    for (const entry of seed.workOrderStatusHistory) {
      const existing = byOrder.get(entry.workOrderId) ?? [];
      byOrder.set(entry.workOrderId, [...existing, entry]);
    }

    const illegal: string[] = [];
    for (const [orderId, entries] of byOrder) {
      const ordered = [...entries].sort((a, b) => a.at.localeCompare(b.at));
      ordered.forEach((entry, index) => {
        if (index === 0) {
          if (entry.from !== null)
            illegal.push(`${orderId} starts at ${entry.from}`);
          return;
        }
        if (!canTransition(entry.from!, entry.to)) {
          illegal.push(`${orderId}: ${entry.from} -> ${entry.to}`);
        }
      });
    }

    expect(illegal).toEqual([]);
    expect(byOrder.size).toBe(seed.workOrders.length);
  });

  it("keeps status and dates telling the same story", () => {
    const wrong: string[] = [];
    for (const order of seed.workOrders) {
      const completed = order.status === "completed";
      const cancelled = order.status === "cancelled";
      if (completed !== (order.completedAt !== null)) {
        wrong.push(
          `${order.number}: completedAt does not match ${order.status}`,
        );
      }
      if (cancelled !== (order.cancellationReason !== null)) {
        wrong.push(`${order.number}: cancelling without a reason`);
      }
      if (order.completedAt && order.completedAt.slice(0, 10) > "2026-09-12") {
        wrong.push(`${order.number}: completed in the future`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("is identical on every run, and different for a different generator", () => {
    expect(buildSeed(TODAY)).toEqual(buildSeed(TODAY));
    // The control: if the generator were ignored, the line above would pass on
    // anything at all, including data that never varied.
    expect(buildSeed(TODAY, 999)).not.toEqual(buildSeed(TODAY));
  });

  it("moves with the calendar", () => {
    const later = buildSeed(new Date("2026-12-25T00:00:00.000Z"));
    expect(later.workOrders[0]!.requestedAt).not.toBe(
      seed.workOrders[0]!.requestedAt,
    );
  });
});

describe("who work is assigned to", () => {
  const seed: DemoData = buildSeed(TODAY);
  const assignments = seed.workOrderAssignments;
  const personAndCrew = assignments.filter((a) => a.userId && a.crewCode);
  const crewOnly = assignments.filter((a) => !a.userId && a.crewCode);
  const personOnly = assignments.filter((a) => a.userId && !a.crewCode);
  const neither = assignments.filter((a) => !a.userId && !a.crewCode);

  it("holds exactly three assigned to a crew and to nobody", () => {
    /*
     * The third state, present on purpose. Every other assignment carries both
     * a person and a crew code, and the MP2 fixture resolves every code it
     * contains, so without these three the case where a code names no person
     * would not occur anywhere in the demonstration — and the queue's Crew
     * facet would be a filter that never matches anything.
     *
     * The count is exact rather than "at least one", so that adding a fourth is
     * a decision somebody makes rather than something that drifts.
     */
    expect(crewOnly).toHaveLength(3);
    expect(personAndCrew).toHaveLength(assignments.length - 3);
  });

  it("puts them at three different sites, on work nobody has picked up", () => {
    const sites = new Set(
      crewOnly.map(
        (a) =>
          seed.workOrders.find((order) => order.id === a.workOrderId)!
            .facilityId,
      ),
    );
    const statuses = new Set(
      crewOnly.map(
        (a) =>
          seed.workOrders.find((order) => order.id === a.workOrderId)!.status,
      ),
    );

    // More than one site, so the facet is not one row at one laboratory.
    expect(sites.size).toBe(3);
    expect([...statuses]).toEqual(["open"]);
  });

  it("has neither of the two states that would mean something is wrong", () => {
    /*
     * The control, and it is the assertion that used to be the whole test,
     * inverted. An assignment with a person and no crew code, or with neither,
     * would each mean the seed had started producing a shape nothing intends —
     * and both would make the counts above pass while the data underneath had
     * changed.
     */
    expect(personOnly).toHaveLength(0);
    expect(neither).toHaveLength(0);
    expect(assignments.length).toBeGreaterThan(30);
  });
});

/**
 * What the parts ledger has to draw.
 *
 * WA-38's review recorded that the seed held no movement with
 * `workOrderId: null` — every one belonged to a work order — so a control that
 * needed "a movement belonging to no order" found nothing and passed by
 * finding nothing. WA-12 draws a part's ledger, which makes the gap visible
 * rather than theoretical: a shelf count is exactly the movement that belongs
 * to no job, and the screen has a case for it.
 */
describe("the movements a part's ledger reads", () => {
  const movements = buildSeed(TODAY).inventoryTransactions;

  it("includes at least one that belongs to no work order", () => {
    const loose = movements.filter((one) => one.workOrderId === null);

    expect(loose.length).toBeGreaterThan(0);
    // Every one of them is a count, which is the only kind that legitimately
    // belongs to no job — a loose `issue` would mean stock left the store
    // against nothing.
    expect(
      loose.every((one) => one.kind === "adjustment" || one.kind === "receipt"),
    ).toBe(true);

    /*
     * Named by what only a real shelf count has, which the assertion above no
     * longer is on its own.
     *
     * WA-41 adds an opening balance row per part: an `adjustment`, belonging
     * to no order, and there are eleven of them. So "some movement belongs
     * to no order" became true whether or not a single shelf count survived,
     * and the case WA-38's review recorded as missing — a control that passed
     * by finding nothing — would have gone back to being unguarded while this
     * test stayed green.
     *
     * A shelf count is the row where somebody looked at the shelf and found
     * **less than the record claimed**: a negative quantity carrying one of
     * the reasons a counter writes. An opening row is positive and carries its
     * own note, so it cannot satisfy this, and deleting the counts turns it
     * red.
     */
    const counts = loose.filter(
      (one) =>
        one.kind === "adjustment" &&
        one.quantity < 0 &&
        one.note !== null &&
        COUNT_NOTES.includes(one.note),
    );
    expect(counts.length).toBeGreaterThan(0);
  });

  it("still holds movements that do belong to one", () => {
    // The control beside it. Without this, a seed that had stopped attaching
    // any movement to an order would satisfy the assertion above.
    expect(
      movements.filter((one) => one.workOrderId !== null).length,
    ).toBeGreaterThan(0);
  });

  it("covers every kind the domain declares", () => {
    /*
     * Three of the four had no demo data at all: every seeded movement was an
     * `issue`. A ledger that can only ever show one kind demonstrates one
     * quarter of itself, and the three unseeded branches of the screen were
     * drawn by nothing.
     */
    const kinds = new Set(movements.map((one) => one.kind));

    expect([...kinds].sort()).toEqual([
      "adjustment",
      "issue",
      "receipt",
      "return",
    ]);
  });

  it("gives at least one part a ledger worth reading", () => {
    // One row is not a ledger: nothing about ordering, and no second kind to
    // tell apart. The detail page is the screen this seed data exists for.
    const perPart = new Map<string, number>();
    for (const one of movements) {
      perPart.set(one.partId, (perPart.get(one.partId) ?? 0) + 1);
    }

    expect(Math.max(...perPart.values())).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The part a movement names, and the arithmetic the ledger asks a reader to do.
 *
 * Two halves of WA-41. The first is plausibility: a movement has to name a
 * part the equipment on the job would actually take. The second is that the
 * ledger adds up — an evaluator who adds a part's movements reaches the figure
 * the register shows, because the opening balance is on the screen with them.
 */
describe("the parts a movement names", () => {
  const seed = buildSeed(TODAY);

  it("has a pool of real parts for every kind of equipment", () => {
    /*
     * What the type system cannot say. `PART_POOLS` is a `Record` over
     * `AssetTypeKey`, so a missing kind of equipment does not compile — but an
     * empty pool, or a stock number that no longer exists, compiles perfectly
     * and makes `partsFor` fall back to the whole catalogue. The records still
     * look reasonable and the pooling has silently stopped happening for that
     * equipment, with every other assertion here still green.
     */
    const numbers = new Set(PART_SEEDS.map((part) => part.partNumber));
    for (const type of ASSET_TYPE_SEEDS) {
      const pool = PART_POOLS[type.key];
      expect(pool.length, `no parts pooled for ${type.key}`).toBeGreaterThan(0);
      for (const number of pool) {
        expect(
          numbers.has(number),
          `${type.key} is pooled with ${number}, which is not in the catalogue`,
        ).toBe(true);
      }
    }
  });

  it("issues only a part the equipment on the job would take", () => {
    /*
     * The defect WA-10's review found: rotation over the whole catalogue put a
     * pleated air filter into a water purification system, a mesh prefilter
     * into an ultra-low freezer, and a HEPA filter and a 48-inch V-belt into a
     * fire alarm control panel. The derivation was right and the content was
     * not, which a maintenance evaluator reads instantly.
     */
    const typeById = new Map(seed.assetTypes.map((type) => [type.id, type]));
    const assetById = new Map(seed.assets.map((asset) => [asset.id, asset]));
    const orderById = new Map(
      seed.workOrders.map((order) => [order.id, order]),
    );
    const partById = new Map(seed.parts.map((part) => [part.id, part]));

    const linked = seed.inventoryTransactions.filter(
      (movement) => movement.workOrderId !== null,
    );

    const wrong: string[] = [];
    for (const movement of linked) {
      const order = orderById.get(movement.workOrderId ?? "");
      const asset = order ? assetById.get(order.assetId) : undefined;
      const type = asset ? typeById.get(asset.assetTypeId) : undefined;
      const part = partById.get(movement.partId);
      if (!order || !asset || !type || !part) {
        // Unresolved is its own answer, never quietly "fine": a movement whose
        // asset cannot be found has not been checked for plausibility at all.
        wrong.push(`${movement.id}: could not be resolved to an asset type`);
        continue;
      }
      const pool = (
        PART_POOLS as Record<string, readonly string[] | undefined>
      )[type.key];
      if (pool === undefined || !pool.includes(part.partNumber)) {
        wrong.push(
          `${movement.id}: ${part.partNumber} ${part.name.en} on ${type.key}`,
        );
      }
    }

    expect(wrong).toEqual([]);
    // The floor beside it: a list of problems drawn from nothing is empty for
    // the wrong reason.
    expect(linked.length).toBeGreaterThanOrEqual(15);
  });
});

describe("a part's ledger against what the shelf holds", () => {
  /** Every part that has movements, with its ledger in date order. */
  function ledgers(seed: DemoData) {
    return seed.parts
      .map((part) => ({
        part,
        movements: seed.inventoryTransactions
          .filter((movement) => movement.partId === part.id)
          .sort((a, b) => a.at.localeCompare(b.at)),
      }))
      .filter((entry) => entry.movements.length > 0);
  }

  it("adds up: an opening balance plus the movements is the quantity on hand", () => {
    /*
     * The gap this closes. `quantityOnHand` was set when the part was built
     * and no seeded movement adjusted it, so the ledger was history rather
     * than a running balance and adding it up reached a different number than
     * the register showed. Nothing failed; the screen simply did not answer a
     * question an evaluator asks out loud.
     *
     * The three numbers are independent — the on-hand is drawn when the part
     * is built, the movements are seeded, the opening is pinned in
     * `OPENING_COUNTS` — so this compares things that are free to disagree.
     * Change one movement's quantity and the part is named below.
     */
    const entries = ledgers(buildSeed(TODAY));

    const wrong = entries
      .map(({ part, movements }) => ({
        part,
        total: movements.reduce((sum, one) => sum + one.quantity, 0),
      }))
      .filter(({ part, total }) => total !== part.quantityOnHand)
      .map(
        ({ part, total }) =>
          `${part.partNumber}: ledger totals ${total}, on hand ${part.quantityOnHand}`,
      );

    expect(wrong).toEqual([]);

    // Floors. Both assertions above are satisfied by an empty ledger set, and
    // a seed that had stopped attaching movements to parts would read as
    // perfect agreement.
    /*
     * Floors, not targets. Both assertions above are satisfied by an empty
     * ledger set, and a seed that had stopped attaching movements to parts
     * would read as perfect agreement.
     *
     * Eleven parts carry movements, down from fourteen: narrowing the pools
     * from "any part in this category" to "the parts this machine takes"
     * concentrates fifteen issues onto fewer stock numbers, and a counter per
     * kind of equipment spreads them as far as fifteen orders across
     * twenty-seven kinds can reach. The floor sits just under the real number
     * so it catches the seed degrading, which is what a floor is for.
     */
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(
      entries.reduce((count, entry) => count + entry.movements.length, 0),
    ).toBeGreaterThanOrEqual(15);
  });

  it("opens each ledger with a balance, and never a delivery", () => {
    // The row has to be first and has to read as what it is. A `receipt` here
    // would say goods arrived, and nothing arrived — this is what was already
    // on the shelf.
    for (const { part, movements } of ledgers(buildSeed(TODAY))) {
      const first = movements[0]!;
      expect(first.kind, `${part.partNumber} opens with ${first.kind}`).toBe(
        "adjustment",
      );
      expect(first.quantity, `${part.partNumber}`).toBe(
        OPENING_COUNTS[part.partNumber],
      );
      expect(first.workOrderId).toBeNull();
      expect(first.note).toMatch(/^Opening balance/);
    }
  });

  it("holds a pinned opening for every part that has movements", () => {
    /*
     * A part with movements and no pinned opening gets no opening row, which
     * is the honest answer — the seed does not know what that shelf held — but
     * it would reach a reader as a ledger that quietly does not add up. Named
     * here, at the cause, rather than left to surface as a total that is out
     * by an unexplained amount.
     */
    const unpinned = ledgers(buildSeed(TODAY))
      .filter(({ part }) => OPENING_COUNTS[part.partNumber] === undefined)
      .map(({ part }) => part.partNumber);

    expect(unpinned).toEqual([]);
  });

  it("never takes a shelf below zero on the way", () => {
    /*
     * "In order" is the half of the claim a total cannot make. A ledger that
     * ends at the right number having passed through -2 on the way describes a
     * shelf that held a negative number of filters, which is the same kind of
     * defect as an air filter in a water system: not bad arithmetic, a story
     * that could not have happened. Two of WA-12's three ledger parts did
     * exactly this before the receipts were re-chosen.
     */
    const dips: string[] = [];
    for (const { part, movements } of ledgers(buildSeed(TODAY))) {
      let balance = 0;
      for (const movement of movements) {
        balance += movement.quantity;
        if (balance < 0) {
          dips.push(`${part.partNumber} reaches ${balance} at ${movement.id}`);
          break;
        }
      }
    }

    expect(dips).toEqual([]);
  });

  it("still adds up on a different day", () => {
    /*
     * The openings are pinned literals, so they are only correct if the
     * movements they were derived from do not move with the calendar. The
     * dates shift with `today`; the quantities and the parts they name must
     * not. Without this, the seed would reconcile on the day it was pinned and
     * quietly stop reconciling on every other one.
     */
    const entries = ledgers(buildSeed(new Date("2027-01-20T00:00:00.000Z")));
    const wrong = entries
      .filter(
        ({ part, movements }) =>
          movements.reduce((sum, one) => sum + one.quantity, 0) !==
          part.quantityOnHand,
      )
      .map(({ part }) => part.partNumber);

    expect(wrong).toEqual([]);
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });
});

/**
 * The documents a library has to be able to draw.
 *
 * Each of these is a floor under one seeded case, and every one of them was
 * absent before WA-21: paperwork on a work order, a file that is not a PDF, the
 * kinds nothing drew, a version history, and a document that belongs to the
 * organisation rather than to a machine. A case with no seeded record is a
 * screen branch drawn by nothing, which is how `report` and `photo` reached a
 * demonstration with no data behind them.
 */
describe("the documents a library reads", () => {
  const documents = buildSeed(TODAY).documents;

  it("files paperwork on work orders, not only on assets", () => {
    // The half the RFP names first. Every seeded document belonged to an asset
    // and none to an order, so the work-order panel had nothing to draw.
    const onOrders = documents.filter((one) => one.workOrderId !== null);
    expect(onOrders.length).toBeGreaterThanOrEqual(3);

    // The control beside it: a seed that had moved every document onto an
    // order would satisfy the floor above and empty the asset tab.
    expect(
      documents.filter((one) => one.assetId !== null).length,
    ).toBeGreaterThanOrEqual(10);
  });

  it("holds more than one file type", () => {
    /*
     * RFP 4.1.1(b) names Office, Excel and PDF. Every seeded document was
     * `application/pdf`, so a library's type filter had one value in it — a
     * filter with one value demonstrates the filter's absence, not its
     * presence.
     */
    const types = new Set(documents.map((one) => one.mimeType));
    expect(types.size).toBeGreaterThanOrEqual(3);
    for (const type of types) {
      expect(
        ACCEPTED_MIME_TYPES.includes(
          type as (typeof ACCEPTED_MIME_TYPES)[number],
        ),
        `${type} is seeded but would be refused on upload`,
      ).toBe(true);
    }
  });

  it("draws every kind the domain declares", () => {
    // Three of seven had no demo data: `contract`, `report` and `photo`. The
    // same defect WA-12 found when every movement was an issue.
    expect([...new Set(documents.map((one) => one.kind))].sort()).toEqual(
      [...DOCUMENT_KINDS].sort(),
    );
  });

  it("gives one document a history worth reading", () => {
    /*
     * A chain of three, walked the way the repository walks it. One row is not
     * a history: nothing to order, and no earlier version to compare against.
     */
    const byId = new Map(documents.map((one) => [one.id, one]));
    const lengths = documents.map((one) => {
      let length = 0;
      let current: (typeof documents)[number] | undefined = one;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        length += 1;
        current =
          current.previousVersionId === null
            ? undefined
            : byId.get(current.previousVersionId);
      }
      return length;
    });

    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(3);

    // Every link resolves: a chain pointing at a document that is not there
    // would read as the end of the line and silently shorten the history.
    for (const one of documents) {
      if (one.previousVersionId !== null) {
        expect(
          byId.has(one.previousVersionId),
          `${one.id} replaces ${one.previousVersionId}, which is not in the seed`,
        ).toBe(true);
      }
    }
  });

  it("holds a document that belongs to the organisation and nothing else", () => {
    /*
     * Every target null. The type has always allowed it and no record
     * exercised it, so the case was unreachable by construction — present in
     * the shape, absent from the data, and absent from every query. A floor
     * here is what stops it going quietly missing again.
     */
    const organisational = documents.filter(
      (one) =>
        one.assetId === null &&
        one.workOrderId === null &&
        one.facilityId === null &&
        one.maintenancePlanId === null,
    );

    expect(organisational.length).toBeGreaterThanOrEqual(1);
    // And it is not everything: a seed that had detached every document would
    // satisfy the floor above while emptying every other screen.
    expect(organisational.length).toBeLessThan(documents.length);
  });

  it("files one against a maintenance plan", () => {
    expect(
      documents.filter((one) => one.maintenancePlanId !== null).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
