import {
  currentUserIdForRole,
  CREW_CODE_ASSIGNMENTS,
  USER_SEEDS,
} from "./people";
import { isBelowMinimum } from "@/domain/constants/part";
import {
  ASSET_TYPE_SEEDS,
  COUNT_NOTES,
  LEDGER_RECEIPTS,
  OPENING_COUNTS,
  OPENING_NOTE,
  PART_POOLS,
  PART_SEEDS,
} from "./catalog";
import {
  INSPECTION_TEMPLATE_SEEDS,
  MAINTENANCE_PLAN_SEEDS,
  WORK_ORDER_COMMENTS,
  WORK_ORDER_PHRASES,
} from "./work-catalog";
import { BIN_CODES, ORGANIZATION_NAME, ROOM_CODES, SITES } from "./reference";
import { addDays, startOfDay, toIsoDate, toIsoDateTime } from "./dates";
import { FREQUENCY_DAYS } from "@/domain/constants/maintenance";
import { NOTIFIABLE_KINDS } from "@/domain/types/notification";
import { buildNotificationDefaults, buildWorkflowRules } from "./workflow";
import { createRandom, SEED_CONSTANT } from "./random";
import { FOOTPRINTS, PLAN, toFraction } from "./floor-geometry";
import type {
  Asset,
  AssetPlacement,
  AssetType,
  AuditEvent,
  FloorPlan,
  DocumentRecord,
  Facility,
  Id,
  ImportBatch,
  Inspection,
  InspectionFinding,
  InspectionResult,
  InspectionTemplate,
  InventoryLocation,
  InventoryTransaction,
  LocalizedText,
  Location,
  MaintenancePlan,
  NotificationDefault,
  WorkflowRule,
  MaintenanceSchedule,
  EmailLogEntry,
  Notification,
  NotificationPreference,
  Organization,
  Part,
  User,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderStatusHistory,
  WorkOrderTask,
  LabourEntry,
  WorkOrderComment,
  WorkOrderType,
  SiteCode,
} from "@/domain/types";

/**
 * The demonstration records.
 *
 * `buildSeed` is pure: give it the same day and it returns the same records,
 * on every machine and in every test run. Nothing in here reads the clock or
 * calls `Math.random()` — the day arrives as an argument and the randomness
 * comes from one seeded generator — because a demo whose data shifted between
 * two runs could not be reviewed, and a test could not pin it.
 *
 * Dates are relative to that day, so a reviewer opening the demo in November
 * sees work due next week rather than work that was due last year.
 */

/**
 * Bumped because this release adds collections to `DemoData`: `importBatches`
 * from WA-35, and `labourEntries` and `workOrderComments` from WA-37.
 *
 * Without the bump a browser that was seeded earlier the same day passes the
 * `usable` check in the store, keeps records that have no `importBatches` in
 * them, and the first read of that collection spreads `undefined` and throws.
 * The store rebuilds rather than migrates, so the bump is the whole fix.
 *
 * **5 adds no collection.** WA-12 adds rows: shelf counts, receipts and
 * returns, so a part's ledger has more than one line and three of the four
 * movement kinds have demo data at all. Nothing changes shape, so nothing
 * throws — which is exactly why it is worth saying why the number moved.
 *
 * `usable` is `seedVersion === SEED_VERSION && seededOn === day`. A browser
 * that opened the demonstration **earlier the same day** satisfies both
 * without the bump, keeps the old records, and draws a one-line ledger from a
 * build that has the new one. Nothing fails; the screen is simply telling the
 * reader something untrue about the code in front of them — which is the worse
 * of the two outcomes, because a crash gets investigated and a quiet wrong
 * answer gets believed. The records are entirely generated and the store
 * rebuilds rather than migrates, so the bump costs nothing that was not
 * already disposable.
 */
export const SEED_VERSION = 14;

/**
 * Everything `DemoData` holds at this version, sorted.
 *
 * It sits here so that adding a collection breaks a test rather than relying on
 * somebody remembering to bump the number above it. That is not hypothetical:
 * `importBatches` was added on this very branch with the version left at 1,
 * which would have left a browser seeded earlier the same day keeping records
 * that had no such collection and throwing the first time anything read it.
 *
 * Editing this list and editing the version are the same edit, by design — the
 * two are adjacent so neither can be done alone by accident.
 */
export const DEMO_DATA_KEYS = [
  "assetPlacements",
  "assetTypes",
  "assets",
  "auditEvents",
  "documents",
  "emailLog",
  "facilities",
  "floorPlans",
  "importBatches",
  "inspectionFindings",
  "inspectionResults",
  "inspectionTemplates",
  "inspections",
  "inventoryLocations",
  "inventoryTransactions",
  "labourEntries",
  "locations",
  "maintenancePlans",
  "maintenanceSchedules",
  "notificationDefaults",
  "notificationPreferences",
  "notifications",
  "organization",
  "parts",
  "users",
  "workOrderAssignments",
  "workOrderComments",
  "workOrderStatusHistory",
  "workOrderTasks",
  "workOrders",
  "workflowRules",
] as const;

export interface DemoData {
  organization: Organization;
  facilities: Facility[];
  locations: Location[];
  inventoryLocations: InventoryLocation[];
  users: User[];
  assetTypes: AssetType[];
  assets: Asset[];
  parts: Part[];
  maintenancePlans: MaintenancePlan[];
  maintenanceSchedules: MaintenanceSchedule[];
  inspectionTemplates: InspectionTemplate[];
  inspections: Inspection[];
  inspectionResults: InspectionResult[];
  inspectionFindings: InspectionFinding[];
  workOrders: WorkOrder[];
  workOrderTasks: WorkOrderTask[];
  workOrderAssignments: WorkOrderAssignment[];
  workOrderStatusHistory: WorkOrderStatusHistory[];
  labourEntries: LabourEntry[];
  workOrderComments: WorkOrderComment[];
  inventoryTransactions: InventoryTransaction[];
  documents: DocumentRecord[];
  notifications: Notification[];
  /** What would have been sent, if this demonstration had a mail server. */
  emailLog: EmailLogEntry[];
  /** One row per person: what they want to hear about, and in which language. */
  notificationPreferences: NotificationPreference[];
  /**
   * What a person who has never opened the preferences screen hears about, and
   * what an administrator sets for the organisation. One row per kind.
   */
  notificationDefaults: NotificationDefault[];
  /**
   * The rules an administrator may change: which moves are switched off,
   * whether finishing takes a note, and the displayed targets per priority.
   * One row per organisation, so a mutation can address it like any record.
   */
  workflowRules: WorkflowRule[];
  /** Where each placed asset sits on its floor, in fractions of the plan. */
  assetPlacements: AssetPlacement[];
  /** One row per floor that has a drawing, or a block plan when it has none. */
  floorPlans: FloorPlan[];
  auditEvents: AuditEvent[];
  /**
   * Empty in the seed: an import batch only exists because somebody ran an
   * import. Seeding one would put a record of an act that never happened into
   * the trail.
   */
  importBatches: ImportBatch[];
}

const ORGANIZATION_ID = "org-dln";

/** How many work orders sit in each status. Every status is represented. */
const STATUS_MIX: Readonly<Record<WorkOrderStatus, number>> = {
  completed: 15,
  open: 6,
  inProgress: 6,
  assigned: 5,
  waitingForParts: 4,
  cancelled: 4,
};

/** Four kinds every site has, then a sample of the rest: twelve per site. */
const CORE_ASSET_TYPES = [
  "airHandlingUnit",
  "fireAlarmPanel",
  "emergencyGenerator",
  "eyewashStation",
];
const ASSETS_PER_SITE = 12;

/**
 * The machines that stand on the floor the map draws, and the room each is in.
 *
 * **Why a pinned table rather than the shuffle.** The map exists to be read,
 * and a floor the shuffle happened to leave with two machines on it reads as
 * "this product tracks two machines" — which is what the owner saw. These are
 * moved onto `MCT-B01-F1`, the floor the drawing is of, so the plan shows a
 * working floor rather than a sample of one.
 *
 * **Moved, not added, and the difference was measured.** Appending one asset
 * to the estate moves eleven collections' fingerprints — `documents` and
 * `inspections` sample from the asset array, and every later draw from the
 * shared generator shifts — while changing an asset's room moves two:
 * `assets`, and `workOrders` because an order copies its machine's
 * `locationId` and the order goes where the machine goes. So the floor is
 * populated from the estate the seed already builds.
 *
 * The categories are therefore the ones Moncton has: containment and the
 * plant that serves it. The drawing shows biosafety cabinets and freezers,
 * which this site holds no records of; adding them is the eleven-collection
 * change above and waits for the owner's own drawing, when the positions are
 * re-traced anyway.
 */
const DRAWN_FLOOR_ROOMS: Record<string, string> = {
  // The two the floor already held, kept where they were.
  airHandlingUnit: "MCT-B01-127",
  dehumidifier: "MCT-B01-187",
  // Moved onto it, each into the room its kind belongs in: the machines that
  // serve the suite in 127, the containment equipment in 187.
  autoclave: "MCT-B01-127",
  vacuumPump: "MCT-B01-127",
  eyewashStation: "MCT-B01-187",
  airlockInterlock: "MCT-B01-187",
  effluentDecontamination: "MCT-B01-187",
  roomPressureMonitor: "MCT-B01-187",
};

/**
 * The sites a type is pinned to, or `undefined` when every site may have it.
 *
 * Asked with `in` rather than read with a dot, because `ASSET_TYPE_SEEDS` is
 * `as const satisfies`: the inferred type is the union of the entries as
 * written, and an entry without `onlyAt` does not have the property at all. A
 * cast would have compiled and thrown the narrowing away — the same literal
 * types that make `PART_POOLS` exhaustive are what makes this honest.
 */
function sitesFor(
  type: (typeof ASSET_TYPE_SEEDS)[number],
): readonly SiteCode[] | undefined {
  return "onlyAt" in type ? type.onlyAt : undefined;
}

interface RoomCode {
  site: string;
  building: string;
  floor: string;
  room: string;
  code: string;
}

function parseRoomCode(code: string): RoomCode {
  const [site, building, room] = code.split("-");
  return {
    site: site as string,
    building: building as string,
    floor: (room as string).slice(0, 1),
    room: room as string,
    code,
  };
}

function numberedName(en: string, fr: string, value: string): LocalizedText {
  return { en: `${en} ${value}`, fr: `${fr} ${value}` };
}

export function buildSeed(today: Date, seed: number = SEED_CONSTANT): DemoData {
  const random = createRandom(seed);
  const day0 = startOfDay(today);
  const year = day0.getUTCFullYear();

  const organization: Organization = {
    id: ORGANIZATION_ID,
    name: ORGANIZATION_NAME,
    code: "DLN",
  };

  // --- Sites, buildings, floors, rooms -------------------------------------
  const facilities: Facility[] = SITES.map((site) => ({
    id: `fac-${site.code}`,
    organizationId: ORGANIZATION_ID,
    code: site.code,
    name: site.name,
    city: site.city,
    province: site.province,
    timeZone: site.timeZone,
  }));

  const rooms = ROOM_CODES.map(parseRoomCode);
  const locations: Location[] = [];
  const seenBuildings = new Set<string>();
  const seenFloors = new Set<string>();

  for (const room of rooms) {
    const facilityId = `fac-${room.site}`;
    const buildingId = `loc-${room.site}-${room.building}`;
    const floorId = `${buildingId}-F${room.floor}`;

    if (!seenBuildings.has(buildingId)) {
      seenBuildings.add(buildingId);
      locations.push({
        id: buildingId,
        organizationId: ORGANIZATION_ID,
        facilityId,
        parentId: null,
        kind: "building",
        code: `${room.site}-${room.building}`,
        name: numberedName("Building", "Bâtiment", room.building.slice(1)),
      });
    }

    if (!seenFloors.has(floorId)) {
      seenFloors.add(floorId);
      locations.push({
        id: floorId,
        organizationId: ORGANIZATION_ID,
        facilityId,
        parentId: buildingId,
        kind: "floor",
        code: `${room.site}-${room.building}-F${room.floor}`,
        name: numberedName("Floor", "Étage", room.floor),
      });
    }

    locations.push({
      id: `loc-${room.code}`,
      organizationId: ORGANIZATION_ID,
      facilityId,
      parentId: floorId,
      kind: "room",
      code: room.code,
      name: numberedName("Room", "Salle", room.room),
    });
  }

  const inventoryLocations: InventoryLocation[] = BIN_CODES.map((code) => {
    const [site, aisle, shelf] = code.split("-");
    return {
      id: `bin-${code}`,
      organizationId: ORGANIZATION_ID,
      facilityId: `fac-${site}`,
      code,
      aisle: aisle as string,
      shelf: shelf as string,
    };
  });

  // --- People ---------------------------------------------------------------
  const users: User[] = USER_SEEDS.map((person) => ({
    id: person.id,
    organizationId: ORGANIZATION_ID,
    employeeNumber: person.employeeNumber,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    role: person.role,
    homeFacilityId: `fac-${person.siteCode}`,
    trades: person.trades,
    active: true,
    startedOn: toIsoDate(addDays(day0, -person.startedDaysAgo)),
  }));

  const technicians = users.filter((user) => user.role === "technician");
  const coordinators = users.filter(
    (user) => user.role === "maintenanceCoordinator",
  );
  const inspectors = users.filter((user) => user.role === "inspector");
  const raisedBy = currentUserIdForRole("maintenanceCoordinator");

  // --- Equipment ------------------------------------------------------------
  const assetTypes: AssetType[] = ASSET_TYPE_SEEDS.map((type) => ({
    id: `atp-${type.key}`,
    organizationId: ORGANIZATION_ID,
    key: type.key,
    label: type.label,
    category: type.category,
    tagPrefix: type.tagPrefix,
  }));

  const assets: Asset[] = [];
  const tagCounters = new Map<string, number>();

  for (const site of SITES) {
    const siteRooms = random.shuffle(
      rooms.filter((room) => room.site === site.code),
    );
    const core = ASSET_TYPE_SEEDS.filter((type) =>
      CORE_ASSET_TYPES.includes(type.key),
    );

    /*
     * Equipment this site has because of what this site is.
     *
     * Containment belongs to Moncton and food-lab instruments to the food
     * laboratories, so a type that names its sites is **guaranteed** at each of
     * them and never sampled anywhere else. Sampling them would have meant a
     * containment estate that sometimes had no pressure monitor, which is the
     * one thing a reader from that world checks first.
     *
     * The total per site does not move: pinned types come out of the same
     * twelve, so the register holds what it held.
     */
    const pinnedHere = ASSET_TYPE_SEEDS.filter((type) =>
      sitesFor(type)?.includes(site.code),
    );
    const rest = random.sample(
      ASSET_TYPE_SEEDS.filter(
        (type) => !CORE_ASSET_TYPES.includes(type.key) && !sitesFor(type),
      ),
      ASSETS_PER_SITE - core.length - pinnedHere.length,
    );

    [...core, ...pinnedHere, ...rest].forEach((type, index) => {
      /*
       * The drawn floor's machines go to their pinned rooms; everything else
       * takes the shuffle's answer. Reading the table costs no randomness, so
       * the generator is where it was and no later collection moves.
       */
      const drawnRoom =
        site.code === "MCT" ? DRAWN_FLOOR_ROOMS[type.key] : undefined;
      const room = (
        drawnRoom
          ? rooms.find((candidate) => candidate.code === drawnRoom)
          : siteRooms[index % siteRooms.length]
      ) as RoomCode;
      // Numbering starts at 11. Every tag in the MP2 fixture ends in 01 to 03,
      // so the two sets cannot collide — which keeps the import's duplicate
      // report exactly as long as WA-29 documented it. A unit test proves it.
      const counterKey = `${type.tagPrefix}-${site.code}`;
      const next = (tagCounters.get(counterKey) ?? 10) + 1;
      tagCounters.set(counterKey, next);
      const assetTag = `${type.tagPrefix}-${site.code}-${String(next).padStart(2, "0")}`;
      const manufacturer = random.pick(type.manufacturers);

      assets.push({
        id: `ast-${assetTag}`,
        organizationId: ORGANIZATION_ID,
        assetTag,
        name: {
          en: `${type.label.en} ${assetTag}`,
          fr: `${type.label.fr} ${assetTag}`,
        },
        assetTypeId: `atp-${type.key}`,
        facilityId: `fac-${site.code}`,
        locationId: `loc-${room.code}`,
        manufacturer,
        model: `${manufacturer.slice(0, 2).toUpperCase()}-${random.int(1000, 9999)}`,
        serialNumber: `${String.fromCharCode(65 + random.int(0, 25))}${random.int(10, 99)}${String.fromCharCode(65 + random.int(0, 25))}-${random.int(10000, 99999)}`,
        /*
         * Under this type's ceiling, not a flat twenty years for everything.
         *
         * One range for the whole estate let a UPS and a CO2 incubator be as
         * old as a boiler, and a maintenance reader knows a twenty-year-old UPS
         * is a battery nobody replaced rather than an asset on a register. The
         * floor stays at 400 days so nothing reads as installed last week.
         */
        installedAt: toIsoDate(
          addDays(day0, -random.int(400, type.maxAgeYears * 365)),
        ),
        status: random.chance(0.88)
          ? "active"
          : random.chance(0.5)
            ? "inactive"
            : "decommissioned",
        criticality: random.pick([
          "critical",
          "critical",
          "high",
          "high",
          "medium",
          "low",
        ] as const),
        parentAssetId: null,
      });
    });
  }

  const activeAssets = assets.filter((asset) => asset.status === "active");

  // --- Spare parts ----------------------------------------------------------
  const parts: Part[] = PART_SEEDS.map((part, index) => {
    const bin = inventoryLocations[
      index % inventoryLocations.length
    ] as InventoryLocation;
    // Roughly one part in five sits below its minimum, which is what the
    // dashboard's exception card and the parts notification are for.
    const belowMinimum = index % 5 === 0;
    return {
      id: `prt-${part.partNumber}`,
      organizationId: ORGANIZATION_ID,
      partNumber: part.partNumber,
      name: part.name,
      category: part.category,
      unitCost: part.unitCost,
      unitOfMeasure: part.unitOfMeasure,
      quantityOnHand: belowMinimum
        ? random.int(0, Math.max(0, part.reorderPoint - 1))
        : part.reorderPoint + random.int(2, 20),
      reorderPoint: part.reorderPoint,
      facilityId: bin.facilityId,
      inventoryLocationId: bin.id,
    };
  });

  // --- Maintenance plans and their schedules --------------------------------
  /*
   * A plan exists for equipment the estate actually holds.
   *
   * The plans table draws "No equipment" rather than a nought for a plan with
   * no schedules, deliberately, because that is a problem somebody should see.
   * WA-87's pinned equipment comes out of the twelve-per-site budget, and the
   * chiller lost its last asset to that squeeze — leaving `PM-CHL-A` on the
   * screen with nothing to visit, which is the sentence the plans table exists
   * to make about a real defect, shown for one that is merely an accident of
   * arithmetic.
   *
   * The rule rather than the special case: the seed does not emit a plan for a
   * type it seeded no equipment of. It self-heals the next time the budget
   * moves, and `tests/unit/plans-have-equipment.test.ts` names any plan that
   * slips through.
   *
   * Keeping a chiller instead would also have been defensible and is the
   * content half of this decision; it is recorded in the pull request as one
   * for the owner, since it changes which equipment the estate is made of.
   */
  const seededTypeIds = new Set(assets.map((asset) => asset.assetTypeId));
  const maintenancePlans: MaintenancePlan[] = MAINTENANCE_PLAN_SEEDS.filter(
    (plan) => seededTypeIds.has(`atp-${plan.assetTypeKey}`),
  ).map((plan) => ({
    id: `pln-${plan.code}`,
    organizationId: ORGANIZATION_ID,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    assetTypeId: `atp-${plan.assetTypeKey}`,
    frequency: plan.frequency,
    leadTimeDays: plan.leadTimeDays,
    estimatedMinutes: plan.estimatedMinutes,
    active: true,
    tasks: plan.tasks,
  }));

  const maintenanceSchedules: MaintenanceSchedule[] = [];
  for (const plan of maintenancePlans) {
    for (const asset of assets.filter(
      (candidate) =>
        candidate.assetTypeId === plan.assetTypeId &&
        candidate.status !== "decommissioned",
    )) {
      const period = FREQUENCY_DAYS[plan.frequency];
      // Spread the next visits either side of today so the planner has both
      // overdue and upcoming work on screen.
      const nextInDays = random.int(-21, period);
      maintenanceSchedules.push({
        id: `sch-${plan.code}-${asset.assetTag}`,
        organizationId: ORGANIZATION_ID,
        planId: plan.id,
        assetId: asset.id,
        lastCompletedOn: toIsoDate(addDays(day0, nextInDays - period)),
        nextDueOn: toIsoDate(addDays(day0, nextInDays)),
        workOrderId: null,
      });
    }
  }

  // --- Work orders ----------------------------------------------------------
  const workOrders: WorkOrder[] = [];
  const workOrderTasks: WorkOrderTask[] = [];
  const workOrderAssignments: WorkOrderAssignment[] = [];
  const workOrderStatusHistory: WorkOrderStatusHistory[] = [];
  const labourEntries: LabourEntry[] = [];
  const workOrderComments: WorkOrderComment[] = [];
  const crewCodes = Object.keys(CREW_CODE_ASSIGNMENTS);

  const statusPlan: WorkOrderStatus[] = (
    Object.entries(STATUS_MIX) as [WorkOrderStatus, number][]
  ).flatMap(([status, count]) => Array.from({ length: count }, () => status));

  statusPlan.forEach((status, index) => {
    const sequence = index + 1;
    const number = `WO-${year}-${String(sequence).padStart(4, "0")}`;
    const asset = random.pick(activeAssets);
    const type = random.pick([
      "preventive",
      "preventive",
      "corrective",
      "corrective",
      "inspection",
      "calibration",
      "safety",
      "emergency",
    ] as const satisfies readonly WorkOrderType[]);
    const phrase = random.pick(WORK_ORDER_PHRASES[type]);
    const priority = random.pick([
      "critical",
      "high",
      "high",
      "medium",
      "medium",
      "low",
    ] as const satisfies readonly WorkOrderPriority[]);

    const requestedDaysAgo =
      status === "completed" ? random.int(20, 150) : random.int(1, 45);
    const requestedDay = addDays(day0, -requestedDaysAgo);
    const requestedAt = toIsoDateTime(requestedDay, 13, random.int(0, 59));
    // Open work is deliberately allowed to fall behind: a dashboard with
    // nothing overdue demonstrates nothing.
    const dueDay = addDays(requestedDay, random.int(3, 30));
    const startedDay = addDays(requestedDay, random.int(1, 5));
    const completedDay = addDays(startedDay, random.int(1, 12));

    const started =
      status === "inProgress" ||
      status === "waitingForParts" ||
      status === "completed";

    workOrders.push({
      id: `wko-${number}`,
      organizationId: ORGANIZATION_ID,
      number,
      title: {
        en: `${phrase.title.en} — ${asset.assetTag}`,
        fr: `${phrase.title.fr} — ${asset.assetTag}`,
      },
      description: phrase.description,
      // Authored in both languages rather than typed by anyone, so there is no
      // single language to record.
      contentLanguage: null,
      assetId: asset.id,
      facilityId: asset.facilityId,
      locationId: asset.locationId,
      type,
      status,
      priority,
      requestedAt,
      dueAt: toIsoDate(dueDay),
      startedAt: started ? toIsoDateTime(startedDay, 8, 30) : null,
      completedAt:
        status === "completed" ? toIsoDateTime(completedDay, 15, 45) : null,
      cancelledAt:
        status === "cancelled"
          ? toIsoDateTime(addDays(requestedDay, 2), 10, 15)
          : null,
      cancellationReason:
        status === "cancelled"
          ? {
              key: random.pick([
                "duplicate",
                "noLongerRequired",
                "assetDecommissioned",
                "handledUnderAnotherOrder",
              ] as const),
              note: null,
            }
          : null,
      maintenancePlanId: null,
      source: "manual",
      estimatedMinutes: random.int(2, 16) * 30,
    });

    // Tasks: what the person on site actually ticks off.
    const taskCount = random.int(2, 4);
    for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
      const done = status === "completed" || (started && taskIndex === 0);
      workOrderTasks.push({
        id: `wkt-${number}-${taskIndex + 1}`,
        organizationId: ORGANIZATION_ID,
        workOrderId: `wko-${number}`,
        sequence: taskIndex + 1,
        description: random.pick(
          MAINTENANCE_PLAN_SEEDS[taskIndex % MAINTENANCE_PLAN_SEEDS.length]!
            .tasks,
        ),
        done,
        completedAt: done ? toIsoDateTime(completedDay, 15, 30) : null,
        completedByUserId: done ? technicians[0]!.id : null,
      });
    }

    /*
     * Labour: one entry per visit, on work that somebody actually started.
     * There is no stored total — `loggedMinutes` adds these up — so an order
     * with no entries has no time logged, which is a different fact from zero
     * minutes and is what an imported order will look like.
     */
    if (started) {
      const visits = status === "completed" ? random.int(1, 3) : 1;
      for (let visit = 0; visit < visits; visit += 1) {
        labourEntries.push({
          id: `lab-${number}-${visit + 1}`,
          organizationId: ORGANIZATION_ID,
          workOrderId: `wko-${number}`,
          userId: random.pick(technicians).id,
          minutes: random.int(2, 12) * 15,
          workedAt: toIsoDateTime(addDays(startedDay, visit), 10, 0),
          note: null,
        });
      }
    }

    /*
     * Comments: what somebody wrote, in the language they wrote it in. Both
     * languages appear across the seed on purpose, so the demonstration shows
     * a French reader an English note marked as English, and the reverse —
     * which is the behaviour WA-27's rule describes and WA-32 draws.
     */
    if (status !== "open" && random.int(1, 3) > 1) {
      const phrase = random.pick(WORK_ORDER_COMMENTS);
      workOrderComments.push({
        id: `wkc-${number}-1`,
        organizationId: ORGANIZATION_ID,
        workOrderId: `wko-${number}`,
        authorUserId: random.pick(technicians).id,
        body: phrase.body,
        contentLanguage: phrase.language,
        createdAt: toIsoDateTime(addDays(requestedDay, 2), 11, 20),
      });
    }

    // Assignment: everything except an order nobody has picked up yet.
    if (status !== "open") {
      const technician = random.pick(technicians);
      workOrderAssignments.push({
        id: `wka-${number}`,
        organizationId: ORGANIZATION_ID,
        workOrderId: `wko-${number}`,
        userId: technician.id,
        crewCode: random.pick(crewCodes),
        assignedAt: toIsoDateTime(addDays(requestedDay, 1), 9, 0),
        assignedByUserId: random.pick(coordinators).id,
      });
    }

    // History: the path the order actually walked, not a guess at it.
    const path: WorkOrderStatus[] =
      status === "open"
        ? ["open"]
        : status === "cancelled"
          ? ["open", "cancelled"]
          : status === "assigned"
            ? ["open", "assigned"]
            : status === "inProgress"
              ? ["open", "assigned", "inProgress"]
              : status === "waitingForParts"
                ? ["open", "assigned", "inProgress", "waitingForParts"]
                : ["open", "assigned", "inProgress", "completed"];

    path.forEach((to, step) => {
      workOrderStatusHistory.push({
        id: `wkh-${number}-${step + 1}`,
        organizationId: ORGANIZATION_ID,
        workOrderId: `wko-${number}`,
        from: step === 0 ? null : (path[step - 1] as WorkOrderStatus),
        to,
        at: toIsoDateTime(addDays(requestedDay, step), 9 + step, 20),
        byUserId: step === 0 ? raisedBy : random.pick(technicians).id,
        reason:
          to === "cancelled" ? { key: "noLongerRequired", note: null } : null,
      });
    });
  });

  /*
   * Three orders assigned to a crew and to nobody.
   *
   * Every assignment above carries both a person and a crew code, so without
   * these the third state — a code this organisation cannot resolve to a
   * person — would not occur in the demonstration at all, and the queue's Crew
   * facet would be a filter that never matches. The MP2 import does not supply
   * the case either: every code in its fixture resolves.
   *
   * `CONT01` is the one code in the crew map that resolves to something other
   * than a user — external work. Open orders, because nobody here has picked
   * them up, and at three different sites so the facet shows rows at more than
   * one facility.
   */
  const contractorTargets: WorkOrder[] = [];
  const sitesUsed = new Set<Id>();
  for (const order of workOrders) {
    if (order.status !== "open" || sitesUsed.has(order.facilityId)) continue;
    contractorTargets.push(order);
    sitesUsed.add(order.facilityId);
    if (contractorTargets.length === 3) break;
  }

  for (const order of contractorTargets) {
    workOrderAssignments.push({
      id: `wka-${order.number}`,
      organizationId: ORGANIZATION_ID,
      workOrderId: order.id,
      userId: null,
      crewCode: "CONT01",
      assignedAt: toIsoDateTime(addDays(day0, -3), 8, 15),
      assignedByUserId: coordinators[0]!.id,
    });
  }

  // --- Inspections ----------------------------------------------------------
  const inspectionTemplates: InspectionTemplate[] =
    INSPECTION_TEMPLATE_SEEDS.map((template) => ({
      id: `int-${template.code}`,
      organizationId: ORGANIZATION_ID,
      code: template.code,
      name: template.name,
      description: template.description,
      assetTypeIds: template.assetTypeKeys.map((key) => `atp-${key}`),
      items: template.items.map((item, index) => ({
        id: `ini-${template.code}-${index + 1}`,
        sequence: index + 1,
        prompt: item.prompt,
        requiresNoteOnFail: item.requiresNoteOnFail,
      })),
    }));

  const inspections: Inspection[] = [];
  const inspectionResults: InspectionResult[] = [];
  const inspectionFindings: InspectionFinding[] = [];
  let inspectionSequence = 0;

  for (const template of inspectionTemplates) {
    const candidates = assets.filter((asset) =>
      template.assetTypeIds.includes(asset.assetTypeId),
    );
    for (const asset of random.sample(
      candidates,
      Math.min(3, candidates.length),
    )) {
      inspectionSequence += 1;
      const id = `ins-${String(inspectionSequence).padStart(4, "0")}`;
      // One inspection in six is still to come; one fails and raises work.
      const upcoming = inspectionSequence % 6 === 0;
      const fails = inspectionSequence % 5 === 0;
      const performedDay = addDays(day0, -random.int(2, 60));

      inspections.push({
        id,
        organizationId: ORGANIZATION_ID,
        templateId: template.id,
        assetId: asset.id,
        facilityId: asset.facilityId,
        scheduledFor: toIsoDate(
          upcoming ? addDays(day0, random.int(2, 25)) : performedDay,
        ),
        performedAt: upcoming ? null : toIsoDateTime(performedDay, 11, 5),
        performedByUserId: upcoming ? null : (inspectors[0]?.id ?? null),
        status: upcoming ? "scheduled" : fails ? "failed" : "passed",
        workOrderId: null,
      });

      if (upcoming) continue;

      template.items.forEach((item, index) => {
        const failedItem = fails && index === 0;
        inspectionResults.push({
          id: `inr-${id}-${index + 1}`,
          organizationId: ORGANIZATION_ID,
          inspectionId: id,
          templateItemId: item.id,
          response: failedItem ? "fail" : "pass",
          note: null,
          recordedAt: toIsoDateTime(performedDay, 11, 10 + index),
        });

        if (failedItem) {
          inspectionFindings.push({
            id: `inf-${id}-${index + 1}`,
            organizationId: ORGANIZATION_ID,
            inspectionId: id,
            templateItemId: item.id,
            severity: "major",
            summary: item.prompt,
            correctiveWorkOrderId: null,
          });
        }
      });
    }
  }

  // --- Parts movement -------------------------------------------------------
  const completedOrders = workOrders.filter(
    (order) => order.status === "completed",
  );
  /*
   * The parts a given piece of equipment plausibly consumes.
   *
   * Rotation over the whole catalogue put a pleated air filter into a water
   * purification system and a V-belt into a fire alarm panel — correct
   * derivation, implausible content, and the first thing a maintenance
   * evaluator notices. `PART_POOLS` narrows the rotation to the parts that
   * belong to the asset's category.
   *
   * By position, never by draw: this block sits above `documents`, which is
   * the one collection after it that reads the shared generator, so a `pick`
   * here would rewrite records nobody meant to touch. Maps and filters consume
   * no randomness.
   *
   * The fallback is not a default part list dressed up. If the asset or its
   * type cannot be resolved we do not *know* the category, and narrowing on a
   * guess would be worse than not narrowing — so the rotation stays over the
   * whole catalogue. `seed-integrity`'s reference check proves that state does
   * not occur in this seed; the branch is there so that a broken reference
   * would read as "unknown" rather than as a confident wrong pairing.
   */
  /** The pool key for equipment whose kind we could not determine. */
  const UNPOOLED = "unpooled";
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const assetTypeById = new Map(assetTypes.map((type) => [type.id, type]));
  const poolFor = (
    order: WorkOrder,
  ): { key: string; parts: readonly Part[] } => {
    const asset = assetById.get(order.assetId);
    const type =
      asset === undefined ? undefined : assetTypeById.get(asset.assetTypeId);
    /*
     * `AssetType.key` is a `string` on the record, so the lookup is widened
     * here rather than asserted with a cast: an equipment kind with no pool is
     * an answer this code has to be able to represent, and `as AssetTypeKey`
     * would claim it cannot happen while doing nothing to make that true.
     */
    const pool =
      type === undefined
        ? undefined
        : (PART_POOLS as Record<string, readonly string[] | undefined>)[
            type.key
          ];
    if (type === undefined || pool === undefined) {
      return { key: UNPOOLED, parts };
    }
    const pooled = parts.filter((part) => pool.includes(part.partNumber));
    return pooled.length > 0
      ? { key: type.key, parts: pooled }
      : { key: UNPOOLED, parts };
  };

  /*
   * Each kind of equipment works through its own pool.
   *
   * A single index shared across every order picks `index % pool.length`, so
   * two cold rooms in a row take the same part and most of a pool is never
   * reached: with the pools narrowed to what a machine actually consumes, that
   * left eleven of twenty-five parts carrying every movement. A counter per
   * kind spreads them the way a storeroom's own history would, and a `Map` of
   * counts draws no randomness.
   */
  const takenPerType = new Map<string, number>();

  const inventoryTransactions: InventoryTransaction[] = completedOrders.map(
    (order, index) => {
      const pool = poolFor(order);
      const taken = takenPerType.get(pool.key) ?? 0;
      takenPerType.set(pool.key, taken + 1);
      const part = pool.parts[taken % pool.parts.length] as Part;
      return {
        id: `inv-${String(index + 1).padStart(4, "0")}`,
        organizationId: ORGANIZATION_ID,
        partId: part.id,
        kind: "issue",
        quantity: -random.int(1, 4),
        at: order.completedAt ?? order.requestedAt,
        byUserId: random.pick(technicians).id,
        workOrderId: order.id,
        note: null,
      };
    },
  );

  /*
   * Movements that are not issues against a job.
   *
   * WA-12 draws a part's ledger, and until now every seeded movement was an
   * `issue` belonging to a work order — fifteen of them, at most one per part,
   * so ten of the twenty-five parts had an empty ledger and no part had two
   * rows to put in order. A ledger with one line does not demonstrate a ledger,
   * and three of the four movement kinds had no demo data at all.
   *
   * Three parts get a history, chosen by position so the set is stable: they
   * are the ones the register shows first and therefore the ones a
   * demonstration opens. Each gets a shelf count with a reason and **no work
   * order** — the case `work-order-detail.test.ts` once asserted existed and
   * did not, so its control passed by finding nothing — plus a receipt and a
   * return, so every kind the domain declares is represented.
   *
   * These are history, not a running balance. `quantityOnHand` is set when the
   * part is built and no seeded movement adjusts it, which was already true of
   * the fifteen issues; reconciling the two is a larger change to the seed and
   * belongs with WA-41's pooling rather than here.
   */
  const ledgerParts = parts.slice(0, 3);
  let extraMovement = inventoryTransactions.length;
  ledgerParts.forEach((part, index) => {
    const nextId = () => {
      extraMovement += 1;
      return `inv-${String(extraMovement).padStart(4, "0")}`;
    };
    /*
     * Chosen by position, **not** by `random.pick`.
     *
     * `createRandom` is one sequential generator shared by the whole build, so
     * a block inserted in the middle that draws from it shifts every record
     * generated after it. This block sits above `documents`, `notifications`
     * and `auditEvents`; three `pick` calls here silently rewrote all three —
     * measured, not feared: it rewrote `documents`, which is the only
     * collection after this point that draws from the generator. Two committed
     * screenshots moved with it — not the 77 it was first reported as, which
     * were main-side and nothing to do with this branch.
     *
     * `buildSeed` is still deterministic either way, which is exactly why this
     * is easy to miss. Determinism promises the same input gives the same
     * output; it promises nothing about an addition leaving the rest alone. Any
     * new block placed mid-build has to consume no randomness, or move to the
     * end where there is nothing after it to disturb.
     */
    const keeper = technicians[index % technicians.length]!.id;
    const plausibleOrders = completedOrders.filter((candidate) =>
      poolFor(candidate).parts.some((pooled) => pooled.id === part.id),
    );

    inventoryTransactions.push({
      id: nextId(),
      organizationId: ORGANIZATION_ID,
      partId: part.id,
      kind: "adjustment",
      // Signed: the count found fewer on the shelf than the record held.
      quantity: -(index + 1),
      at: toIsoDateTime(addDays(day0, -(21 + index)), 9, 15),
      byUserId: keeper,
      workOrderId: null,
      note: COUNT_NOTES[index % COUNT_NOTES.length] ?? null,
    });

    inventoryTransactions.push({
      id: nextId(),
      organizationId: ORGANIZATION_ID,
      partId: part.id,
      kind: "receipt",
      // Literal per part rather than `6 + index`: two of the three could not be
      // reconciled against the on-hand the part already had. See
      // `LEDGER_RECEIPTS`.
      quantity: LEDGER_RECEIPTS[index] ?? 1,
      at: toIsoDateTime(addDays(day0, -(14 + index)), 13, 40),
      byUserId: keeper,
      workOrderId: null,
      note: null,
    });

    /*
     * Only when there is a job it could have come back off.
     *
     * A `return` belonging to no work order is stock arriving from nothing,
     * which is the one thing `seed-integrity` says a loose movement may never
     * be — and with the pools narrowed to what each machine takes, a part can
     * have no completed order whose equipment would have used it. Dropping the
     * row is the honest answer; naming whatever order came next is the
     * implausibility this ticket exists to remove.
     */
    if (plausibleOrders.length > 0)
      inventoryTransactions.push({
        id: nextId(),
        organizationId: ORGANIZATION_ID,
        partId: part.id,
        kind: "return",
        quantity: 1,
        at: toIsoDateTime(addDays(day0, -(7 + index)), 16, 5),
        byUserId: keeper,
        // The order it comes back off is one whose equipment would have taken
        // this part in the first place, not whichever came next.
        workOrderId:
          plausibleOrders[index % plausibleOrders.length]?.id ?? null,
        note: null,
      });
  });

  /*
   * The opening balance, so a person can add the column up.
   *
   * Until now `quantityOnHand` was set when the part was built and no movement
   * touched it, so the ledger was history rather than a running balance: an
   * evaluator who added up a part's movements did not reach the figure the
   * register showed, and there was nothing on the screen to explain the gap.
   * The gap was the stock that was already on the shelf before the first
   * movement the seed records.
   *
   * It is a row rather than a number held somewhere, because the arithmetic
   * has to be visible: a balance the reader is told about but cannot see is
   * the same problem one step further back.
   *
   * **An `adjustment`, not a `receipt`.** A receipt means goods arrived.
   * Nothing arrived — this is what was already there — and a row that reads as
   * a delivery would put stock into the story that never came in. The note
   * says so outright.
   *
   * Dated a day before the part's earliest movement, so it is first in the
   * ledger however the rest of the history falls, and placed here, at the end
   * of the block, where appending cannot renumber the ids WA-12's rows already
   * have. It consumes no randomness: a filter, a comparison and a lookup.
   *
   * A part whose opening is not pinned gets **no row**, deliberately: the seed
   * does not know what that shelf held and inventing a number would make the
   * ledger agree with itself while being made up. `seed-integrity` names any
   * such part rather than letting it pass as a rounding difference.
   */
  const partsWithMovements = parts.filter((part) =>
    inventoryTransactions.some((movement) => movement.partId === part.id),
  );
  partsWithMovements.forEach((part, index) => {
    const opening = OPENING_COUNTS[part.partNumber];
    if (opening === undefined) return;

    const earliest = inventoryTransactions
      .filter((movement) => movement.partId === part.id)
      .reduce((first, movement) => (movement.at < first.at ? movement : first));

    extraMovement += 1;
    inventoryTransactions.push({
      id: `inv-${String(extraMovement).padStart(4, "0")}`,
      organizationId: ORGANIZATION_ID,
      partId: part.id,
      kind: "adjustment",
      quantity: opening,
      at: toIsoDateTime(addDays(new Date(earliest.at), -1), 8, 0),
      byUserId: technicians[index % technicians.length]!.id,
      workOrderId: null,
      note: OPENING_NOTE,
    });
  });

  // --- Documents ------------------------------------------------------------
  const documents: DocumentRecord[] = random
    .sample(assets, 15)
    .map((asset, index) => {
      const kind = random.pick([
        "manual",
        "certificate",
        "drawing",
        "procedure",
      ] as const);
      return {
        id: `doc-${String(index + 1).padStart(4, "0")}`,
        organizationId: ORGANIZATION_ID,
        title: {
          en: `${asset.assetTag} — ${kind === "manual" ? "operating manual" : kind === "certificate" ? "certificate" : kind === "drawing" ? "installation drawing" : "service procedure"}`,
          fr: `${asset.assetTag} — ${kind === "manual" ? "manuel d’utilisation" : kind === "certificate" ? "certificat" : kind === "drawing" ? "plan d’installation" : "procédure d’entretien"}`,
        },
        kind,
        fileName: `${asset.assetTag.toLowerCase()}-${kind}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: random.int(90, 4200) * 1024,
        version: 1,
        uploadedAt: toIsoDateTime(addDays(day0, -random.int(30, 900)), 14, 0),
        uploadedByUserId: random.pick(coordinators).id,
        assetId: asset.id,
        workOrderId: null,
        facilityId: asset.facilityId,
        maintenancePlanId: null,
        previousVersionId: null,
      };
    });

  /*
   * The documents a library has to be able to show.
   *
   * The fifteen above are all filed against an asset, all `application/pdf`,
   * all version 1, and drawn from four of the seven kinds. That was right for
   * WA-10, which drew one asset's tab. It leaves a library with one file type
   * to filter by, no work order with any paperwork at all, no version history
   * to show, and three kinds drawn by nothing — the same shape WA-12 found
   * when every seeded movement was an issue.
   *
   * Every record below is positional. This block sits above `notifications`
   * and `auditEvents`, and while neither draws from the generator today, the
   * rule in `random.ts` is that a block placed mid-build consumes no
   * randomness — not that it may draw when it believes nothing is listening.
   */
  const extraDocuments: DocumentRecord[] = [];
  const documentId = () =>
    `doc-${String(documents.length + extraDocuments.length + 1).padStart(4, "0")}`;

  // Paperwork on work orders: the half the RFP names first and the seed had
  // none of. Mixed types, because a library whose filter has one value in it
  // demonstrates the filter's absence.
  const paperedOrders = completedOrders.slice(0, 3);
  const ORDER_PAPERS = [
    {
      kind: "report" as const,
      fileName: "completion-report.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      en: "Completion report",
      fr: "Rapport d’exécution",
      sizeBytes: 148 * 1024,
    },
    {
      kind: "photo" as const,
      fileName: "site-photographs.pdf",
      mimeType: "application/pdf",
      en: "Site photographs",
      fr: "Photographies du site",
      sizeBytes: 2_600 * 1024,
    },
    {
      kind: "procedure" as const,
      fileName: "isolation-steps.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      en: "Isolation steps followed",
      fr: "Étapes de consignation suivies",
      sizeBytes: 64 * 1024,
    },
  ];
  paperedOrders.forEach((order, index) => {
    const paper = ORDER_PAPERS[index % ORDER_PAPERS.length]!;
    extraDocuments.push({
      id: documentId(),
      organizationId: ORGANIZATION_ID,
      title: {
        en: `${order.number} — ${paper.en}`,
        fr: `${order.number} — ${paper.fr}`,
      },
      kind: paper.kind,
      fileName: `${order.number.toLowerCase()}-${paper.fileName}`,
      mimeType: paper.mimeType,
      sizeBytes: paper.sizeBytes,
      version: 1,
      uploadedAt: toIsoDateTime(addDays(day0, -(11 + index)), 15, 20),
      uploadedByUserId: coordinators[index % coordinators.length]!.id,
      /*
       * Filed against the order, and only the order.
       *
       * Naming the asset as well looks generous and is not: a document filed
       * against two records has to be drawn as one of them, so the library
       * would have shown every piece of order paperwork as the asset's and no
       * row would ever have read "work order" at all. The order already names
       * its asset, so nothing is lost by filing it once.
       */
      assetId: null,
      workOrderId: order.id,
      facilityId: null,
      maintenancePlanId: null,
      previousVersionId: null,
    });
  });

  /*
   * One document with a history, so the version chain is drawn by something.
   *
   * Three records rather than one record with a number: a version is a
   * document in its own right — its own file, size, uploader and date — and
   * the library lists it like any other. Each points at the one it replaced.
   */
  const revisedPlan = maintenancePlans[0];
  if (revisedPlan) {
    let previousVersionId: string | null = null;
    for (const version of [1, 2, 3]) {
      const id = documentId();
      extraDocuments.push({
        id,
        organizationId: ORGANIZATION_ID,
        title: {
          en: `${revisedPlan.code} — standard operating procedure`,
          fr: `${revisedPlan.code} — procédure d’exploitation normalisée`,
        },
        kind: "procedure",
        fileName: `${revisedPlan.code.toLowerCase()}-sop-v${version}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: (310 + version * 24) * 1024,
        version,
        uploadedAt: toIsoDateTime(
          addDays(day0, -(400 - version * 120)),
          10,
          45,
        ),
        uploadedByUserId: coordinators[version % coordinators.length]!.id,
        assetId: null,
        workOrderId: null,
        facilityId: null,
        maintenancePlanId: revisedPlan.id,
        previousVersionId,
      });
      previousVersionId = id;
    }
  }

  /*
   * A document filed against the organisation and nothing else.
   *
   * Not an orphan and not a mistake: a maintenance contract is about the
   * organisation, not about one machine. The type has always allowed it —
   * every target is nullable — and until now no record exercised it and no
   * query could reach it, so the case was unreachable by construction. One
   * seeded record and `forOrganisation` make it visible; `seed-integrity`
   * floors it so it cannot quietly go away again.
   */
  extraDocuments.push({
    id: documentId(),
    organizationId: ORGANIZATION_ID,
    title: {
      en: "Building maintenance services agreement",
      fr: "Entente de services d’entretien des bâtiments",
    },
    kind: "contract",
    fileName: "maintenance-services-agreement.pdf",
    mimeType: "application/pdf",
    sizeBytes: 840 * 1024,
    version: 1,
    uploadedAt: toIsoDateTime(addDays(day0, -220), 9, 5),
    uploadedByUserId: coordinators[0]!.id,
    assetId: null,
    workOrderId: null,
    facilityId: null,
    maintenancePlanId: null,
    previousVersionId: null,
  });

  documents.push(...extraDocuments);

  // --- Notifications --------------------------------------------------------
  const todayIso = toIsoDate(day0);
  const notifications: Notification[] = [];

  for (const order of workOrders) {
    if (
      order.status === "completed" ||
      order.status === "cancelled" ||
      !order.dueAt ||
      order.dueAt >= todayIso
    ) {
      continue;
    }
    notifications.push({
      id: `ntf-ovr-${order.number}`,
      organizationId: ORGANIZATION_ID,
      kind: "workOrderOverdue",
      messageKey: "notifications.workOrderOverdue",
      params: { number: order.number },
      subject: { entity: "workOrder", id: order.id },
      createdAt: toIsoDateTime(addDays(day0, -1), 6, 0),
      readAt: null,
      forUserId: null,
      forRole: "maintenanceCoordinator",
      /*
       * Null, and that is the shape rather than an omission.
       *
       * `eventKey` is how the rules recognise an event they have already
       * reported. These three predate any rule: they exist so a reviewer
       * opening the demonstration finds a bell that is not empty. Giving them
       * a key would tell the overdue rule that it had already announced these
       * orders, and it would then stay silent about the very records the
       * tender's clause is about.
       */
      eventKey: null,
    });
  }

  for (const part of parts.filter((candidate) => isBelowMinimum(candidate))) {
    notifications.push({
      id: `ntf-prt-${part.partNumber}`,
      organizationId: ORGANIZATION_ID,
      kind: "partBelowMinimum",
      messageKey: "notifications.partBelowMinimum",
      params: { partNumber: part.partNumber, onHand: part.quantityOnHand },
      subject: { entity: "part", id: part.id },
      createdAt: toIsoDateTime(addDays(day0, -2), 7, 30),
      readAt: null,
      forUserId: null,
      forRole: "facilityManager",
      eventKey: null,
    });
  }

  for (const inspection of inspections.filter(
    (candidate) => candidate.status === "failed",
  )) {
    notifications.push({
      id: `ntf-ins-${inspection.id}`,
      organizationId: ORGANIZATION_ID,
      kind: "inspectionFailed",
      messageKey: "notifications.inspectionFailed",
      params: { inspection: inspection.id },
      subject: { entity: "inspection", id: inspection.id },
      createdAt: inspection.performedAt ?? toIsoDateTime(day0, 9, 0),
      readAt: null,
      forUserId: null,
      forRole: "facilityManager",
      eventKey: null,
    });
  }

  /*
   * --- What each person wants to hear, and in which language ---------------
   *
   * One row per person, so a preference is a record like everything else and
   * survives a reload without a second storage mechanism.
   *
   * Everything is on by default: a demonstration whose alerts are off shows a
   * reviewer nothing, and the switch is the point of the screen rather than
   * its starting position.
   *
   * The language is the site's, not a personal setting nobody set: the people
   * at the Sudbury laboratory work in French, so the email log shows
   * French subject lines against them however the reader is reading it. That
   * is the whole reason the log names a language at all — an administrator in
   * English has to be able to see that a colleague would have been written to
   * in French.
   */
  const notificationPreferences: NotificationPreference[] = users.map(
    (user) => {
      const facility = facilities.find(
        (candidate) => candidate.id === user.homeFacilityId,
      );
      const language = facility?.code === "SUD" ? "fr" : "en";
      return {
        id: `npf-${user.id}`,
        organizationId: ORGANIZATION_ID,
        userId: user.id,
        language,
        kinds: Object.fromEntries(
          NOTIFIABLE_KINDS.map((kind) => [kind, { inApp: true, email: true }]),
        ) as NotificationPreference["kinds"],
      };
    },
  );

  // --- The trail ------------------------------------------------------------
  const auditEvents: AuditEvent[] = workOrderStatusHistory.map((entry) => {
    const order = workOrders.find(
      (candidate) => candidate.id === entry.workOrderId,
    ) as WorkOrder;
    const actor = users.find((user) => user.id === entry.byUserId) as User;
    return {
      id: `aud-${entry.id}`,
      organizationId: ORGANIZATION_ID,
      at: entry.at,
      actorKind: "person",
      actorUserId: actor.id,
      actorRole: actor.role,
      entity: "workOrder",
      entityId: entry.workOrderId,
      action: entry.from === null ? "created" : "statusChanged",
      summaryKey:
        entry.from === null ? "audit.workOrderCreated" : "audit.statusChanged",
      summaryParams: {
        number: order.number,
        status: entry.to,
      },
      changes:
        entry.from === null
          ? []
          : [{ field: "status", from: entry.from, to: entry.to }],
    };
  });

  // --- Floor plans and where the equipment sits on them --------------------
  /*
   * One drawing, one floor, and the equipment that stands on it.
   *
   * **Why Moncton and why this floor.** The containment estate is at Moncton
   * and the map chapter of the recorded walkthrough goes there. Of the ten
   * Moncton floors, this is the one where the map has something to say: it
   * carries two machines, and one of them has work that is late while the other
   * has none. A floor where every machine is clear draws a plan with nothing on
   * it to notice, and a reviewer would learn nothing about what the outline is
   * for. Measured rather than assumed — `src/data/selectors/floor-map.test.ts` asserts both states
   * are on the floor, so a seed change that flattened them is a red rather than
   * a duller demonstration nobody spots.
   *
   * The two below are every asset the seed puts on that floor, not a selection.
   * A map showing a subset of what is on the floor is a map a reader could
   * catch out by opening the register beside it.
   *
   * **The positions are fractions, read off the drawing at 1344x752.** Both
   * machines stand in the plant room at the centre of the floor, where the
   * drawing shows the vessel and the tank. They are eyeballed against the image
   * rather than surveyed, which is what a demonstration's positions honestly
   * are.
   *
   * **The second row is a floor with no drawing, on purpose.** `MCT-B01-F2`
   * carries `image: null`: the floor was surveyed and no plan is on file. Every
   * other floor in the estate has no row at all, which is the different answer
   * — nobody has looked. The map screen draws all three, and a state nothing
   * seeds is a state nothing is watching.
   */
  const MONCTON_PLAN_FLOOR = "loc-MCT-B01-F1";
  const floorPlans: FloorPlan[] = [
    {
      id: "flp-MCT-B01-F1",
      organizationId: ORGANIZATION_ID,
      floorId: MONCTON_PLAN_FLOOR,
      image: {
        path: "/floorplans/mct-b01-f1.svg",
        widthPx: PLAN.widthPx,
        heightPx: PLAN.heightPx,
      },
    },
    {
      id: "flp-MCT-B01-F2",
      organizationId: ORGANIZATION_ID,
      floorId: "loc-MCT-B01-F2",
      image: null,
    },
  ];

  /*
   * Where each of them stands, derived rather than written.
   *
   * **The fractions used to be the source and they said nothing.** A box like
   * `{ x: 0.52, y: 0.555, width: 0.14 }` is checkable only against itself: it
   * cannot say whether an air handler is the size an air handler is, whether it
   * stands inside the room its record names, or whether it overlaps the machine
   * beside it. WA-121 makes the footprint the thing a person clicks, so the
   * shape became a claim about the world and wanted a unit.
   *
   * So `floor-geometry.ts` holds metres, the drawing is generated from the same
   * file, and these fractions fall out of it. `floor-geometry.test.ts` checks
   * the metres against the equipment, the rooms and each other.
   */
  const PLACEMENT_POSITIONS: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > = Object.fromEntries(FOOTPRINTS.map((one) => [one.tag, toFraction(one)]));

  const assetPlacements: AssetPlacement[] = Object.entries(PLACEMENT_POSITIONS)
    .map(([assetTag, box]) => {
      /*
       * A tag the estate does not hold is not placed, and is not a crash.
       *
       * `buildSeed` takes a generator seed, and `seed-integrity` builds with a
       * different one to prove the records really do depend on it. Under
       * another generator the twelve types Moncton samples are different
       * ones, so a position written against this drawing can name equipment
       * that build never made. Throwing there would make the builder total for
       * exactly one argument, which is not what pure means.
       *
       * The drift this hides — a position for an asset the demonstration no
       * longer has, or an asset on this floor with nowhere to stand — is
       * caught where it can be named instead: `tests/unit/floor-map.test.ts`
       * reports it against the seed the demonstration actually builds.
       */
      const asset = assets.find((one) => one.assetTag === assetTag);
      if (!asset) {
        return null;
      }
      return {
        id: `plc-${assetTag}`,
        organizationId: ORGANIZATION_ID,
        assetId: asset.id,
        floorId: MONCTON_PLAN_FLOOR,
        ...box,
      };
    })
    .filter((placement): placement is AssetPlacement => placement !== null);

  auditEvents.sort((a, b) => b.at.localeCompare(a.at));

  return {
    organization,
    facilities,
    locations,
    assetPlacements,
    floorPlans,
    inventoryLocations,
    users,
    assetTypes,
    assets,
    parts,
    maintenancePlans,
    maintenanceSchedules,
    inspectionTemplates,
    inspections,
    inspectionResults,
    inspectionFindings,
    workOrders,
    workOrderTasks,
    workOrderAssignments,
    workOrderStatusHistory,
    labourEntries,
    workOrderComments,
    inventoryTransactions,
    documents,
    notifications,
    /*
     * Empty in the seed, and deliberately: a line in this log is a record of
     * mail the application decided to send. Seeding one would be a record of a
     * decision nothing made, which is the same defect as seeding an import
     * batch nobody ran.
     */
    emailLog: [],
    notificationPreferences,
    /*
     * Seeded to exactly what the application already did: nothing switched
     * off, a completion note still required, both channels on for every kind.
     * A version bump rebuilds every reviewer's records, and one that also
     * changed behaviour would make the two impossible to tell apart.
     */
    notificationDefaults: buildNotificationDefaults(ORGANIZATION_ID),
    workflowRules: buildWorkflowRules(ORGANIZATION_ID),
    auditEvents,
    importBatches: [],
  };
}
