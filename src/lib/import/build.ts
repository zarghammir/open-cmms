import type {
  Asset,
  Id,
  IsoDateTime,
  Part,
  WorkOrder,
  WorkOrderAssignment,
} from "@/domain/types";
import {
  assetCriticalityFor,
  assetStatusFor,
  tagPrefixOf,
  workOrderPriorityFor,
  workOrderStatusFor,
  workOrderTypeFor,
} from "./codes";
import {
  readCode,
  readDecimal,
  readInteger,
  readIsoDate,
  readText,
  siteOf,
} from "./coerce";
import type { ColumnMapping, SheetKind } from "./mapping";
import type { ImportIssue, SheetData } from "./validate";

/**
 * Turning validated rows into records.
 *
 * Pure: it is handed lookups rather than reaching for a store, so the whole
 * translation can be exercised without a browser. Rows carrying a blocking
 * issue are left out — they have no asset to hang on, no name, or nowhere to
 * be — and the report has already said so.
 */

export interface BuildContext {
  organizationId: Id;
  facilityIdForSite: (site: string) => Id | undefined;
  locationIdForCode: (code: string) => Id | undefined;
  binIdForCode: (code: string) => Id | undefined;
  assetTypeIdForPrefix: (prefix: string) => Id | undefined;
  /** `undefined` for a code the organisation does not use: the order imports unassigned. */
  userIdForCrewCode: (code: string) => Id | undefined;
  /** Who ran the import, recorded on each assignment. */
  actorUserId: Id;
  /** An asset already in WorkAxis, for a work order that points at one. */
  assetIdForTag: (tag: string) => Id | undefined;
  now: IsoDateTime;
}

export interface BuiltRecords {
  assets: Asset[];
  parts: Part[];
  workOrders: WorkOrder[];
  /**
   * One per order that named a crew. `userId` is null when the code is not one
   * the organisation uses — the order arrives unassigned, with the code it came
   * with kept rather than a person invented for it.
   */
  workOrderAssignments: WorkOrderAssignment[];
}

function valueAt(
  sheet: SheetData,
  row: readonly unknown[],
  mapping: ColumnMapping,
  field: string,
): unknown {
  const column = mapping[field];
  if (!column) return undefined;
  const index = sheet.headers.indexOf(column);
  return index === -1 ? undefined : row[index];
}

/**
 * The source has one language. Both slots get the same words rather than a
 * machine translation, which is what `contentLanguage` exists to record: a
 * reader of the other language is told these are the words as they were
 * exported, not a translation of them.
 */
function asEntered(text: string) {
  return { en: text, fr: text };
}

export function buildRecords(
  sheets: readonly SheetData[],
  mappings: Record<SheetKind, ColumnMapping>,
  issues: readonly ImportIssue[],
  context: BuildContext,
): BuiltRecords {
  const blockedRows = new Set(
    issues
      .filter((issue) => issue.severity === "blocking")
      .map((issue) => `${issue.sheet}:${issue.row}`),
  );

  const assets: Asset[] = [];
  const parts: Part[] = [];
  const workOrders: WorkOrder[] = [];
  const workOrderAssignments: WorkOrderAssignment[] = [];
  /** Assets arriving in this same file, so a work order can point at one. */
  const arriving = new Map<string, Id>();

  const usableRows = (kind: SheetKind) => {
    const sheet = sheets.find((candidate) => candidate.kind === kind);
    if (!sheet) return [];
    return sheet.rows
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter((entry) => !blockedRows.has(`${kind}:${entry.rowNumber}`))
      .map((entry) => ({ ...entry, sheet, mapping: mappings[kind] }));
  };

  for (const { row, sheet, mapping } of usableRows("equipment")) {
    const tag = readCode(valueAt(sheet, row, mapping, "assetTag"));
    const name = readText(valueAt(sheet, row, mapping, "name"));
    const location = readCode(valueAt(sheet, row, mapping, "locationCode"));
    if (
      tag.kind !== "value" ||
      name.kind !== "value" ||
      location.kind !== "value"
    ) {
      continue;
    }
    // A duplicate tag arriving twice keeps the first. The report named it; the
    // records are not the place to hold two assets under one tag.
    if (arriving.has(tag.value)) continue;

    const facilityId = context.facilityIdForSite(siteOf(location.value));
    const locationId = context.locationIdForCode(location.value);
    const assetTypeId = context.assetTypeIdForPrefix(tagPrefixOf(tag.value));
    if (!facilityId || !locationId || !assetTypeId) continue;

    const installed = readIsoDate(valueAt(sheet, row, mapping, "installedAt"));
    const status = readCode(valueAt(sheet, row, mapping, "status"));
    const criticality = readCode(valueAt(sheet, row, mapping, "criticality"));
    const manufacturer = readText(valueAt(sheet, row, mapping, "manufacturer"));
    const model = readText(valueAt(sheet, row, mapping, "model"));
    const serial = readText(valueAt(sheet, row, mapping, "serialNumber"));

    const id = `ast-imp-${tag.value}`;
    arriving.set(tag.value, id);
    assets.push({
      id,
      organizationId: context.organizationId,
      assetTag: tag.value,
      name: asEntered(name.value),
      assetTypeId,
      facilityId,
      locationId,
      manufacturer: manufacturer.kind === "value" ? manufacturer.value : "",
      model: model.kind === "value" ? model.value : "",
      serialNumber: serial.kind === "value" ? serial.value : "",
      // An unreadable install date is left unset rather than guessed at. The
      // report has already said the cell could not be read.
      installedAt: installed.kind === "value" ? installed.value : "",
      status:
        (status.kind === "value" ? assetStatusFor(status.value) : undefined) ??
        "active",
      criticality:
        (criticality.kind === "value"
          ? assetCriticalityFor(criticality.value)
          : undefined) ?? "medium",
      parentAssetId: null,
    });
  }

  const seenParts = new Set<string>();
  for (const { row, sheet, mapping } of usableRows("inventory")) {
    const number = readCode(valueAt(sheet, row, mapping, "partNumber"));
    const name = readText(valueAt(sheet, row, mapping, "name"));
    const bin = readCode(valueAt(sheet, row, mapping, "binCode"));
    if (
      number.kind !== "value" ||
      name.kind !== "value" ||
      bin.kind !== "value"
    ) {
      continue;
    }
    if (seenParts.has(number.value)) continue;

    const facilityId = context.facilityIdForSite(siteOf(bin.value));
    const inventoryLocationId = context.binIdForCode(bin.value);
    if (!facilityId || !inventoryLocationId) continue;

    const onHand = readInteger(valueAt(sheet, row, mapping, "quantityOnHand"));
    const reorder = readInteger(valueAt(sheet, row, mapping, "reorderPoint"));
    const cost = readDecimal(valueAt(sheet, row, mapping, "unitCost"));

    seenParts.add(number.value);
    parts.push({
      id: `prt-imp-${number.value}`,
      organizationId: context.organizationId,
      partNumber: number.value,
      name: asEntered(name.value),
      category: "consumables",
      // A negative count is not stock. It imports as nothing on the shelf, and
      // the report says the source claimed otherwise.
      quantityOnHand: onHand.kind === "value" ? Math.max(onHand.value, 0) : 0,
      reorderPoint: reorder.kind === "value" ? Math.max(reorder.value, 0) : 0,
      unitCost: cost.kind === "value" ? cost.value : 0,
      unitOfMeasure: "each",
      facilityId,
      inventoryLocationId,
    });
  }

  const seenOrders = new Set<string>();
  for (const { row, sheet, mapping } of usableRows("workOrders")) {
    const number = readCode(valueAt(sheet, row, mapping, "number"));
    const tag = readCode(valueAt(sheet, row, mapping, "assetTag"));
    const description = readText(valueAt(sheet, row, mapping, "description"));
    const requested = readIsoDate(valueAt(sheet, row, mapping, "requestedAt"));
    if (
      number.kind !== "value" ||
      tag.kind !== "value" ||
      description.kind !== "value" ||
      requested.kind !== "value"
    ) {
      continue;
    }
    if (seenOrders.has(number.value)) continue;

    const assetId = arriving.get(tag.value) ?? context.assetIdForTag(tag.value);
    if (!assetId) continue;
    const asset = assets.find((candidate) => candidate.id === assetId);

    const status = readCode(valueAt(sheet, row, mapping, "status"));
    const resolved =
      (status.kind === "value"
        ? workOrderStatusFor(status.value)
        : undefined) ?? "open";
    const type = readCode(valueAt(sheet, row, mapping, "type"));
    const priority = valueAt(sheet, row, mapping, "priority");
    const due = readIsoDate(valueAt(sheet, row, mapping, "dueAt"));
    const completed = readIsoDate(valueAt(sheet, row, mapping, "completedAt"));
    const crew = readCode(valueAt(sheet, row, mapping, "crewCode"));

    seenOrders.add(number.value);
    workOrders.push({
      id: `wko-imp-${number.value}`,
      organizationId: context.organizationId,
      number: number.value,
      title: asEntered(description.value.slice(0, 80)),
      description: asEntered(description.value),
      // The export is English. Saying so is what stops a French reader being
      // shown English words as though they were French.
      contentLanguage: "en",
      assetId,
      facilityId: asset?.facilityId ?? "",
      locationId: asset?.locationId ?? "",
      type:
        (type.kind === "value" ? workOrderTypeFor(type.value) : undefined) ??
        "corrective",
      status: resolved,
      priority:
        (priority !== undefined
          ? workOrderPriorityFor(priority as string | number)
          : undefined) ?? "medium",
      requestedAt: requested.value,
      dueAt: due.kind === "value" ? due.value : null,
      startedAt: null,
      completedAt: completed.kind === "value" ? completed.value : null,
      cancelledAt: resolved === "cancelled" ? requested.value : null,
      // The source has no reason column. WorkAxis requires one, so the import
      // records that the source did not have it rather than inventing one — and
      // the report lists every row this happened to.
      cancellationReason:
        resolved === "cancelled"
          ? { key: "notRecordedInSource", note: null }
          : null,
      maintenancePlanId: null,
      source: "import",
      estimatedMinutes: null,
      // No time here, and none to come: the source has no minutes column, and
      // time is held as labour entries rather than as a number on the order.
      // An imported order therefore has none, and the screens say "no time
      // logged" rather than "0 min" — see `loggedMinutes`.
    });

    if (crew.kind === "value") {
      workOrderAssignments.push({
        id: `woa-imp-${number.value}`,
        organizationId: context.organizationId,
        workOrderId: `wko-imp-${number.value}`,
        userId: context.userIdForCrewCode(crew.value) ?? null,
        // Kept whether it resolved or not: the code is what the source said,
        // and an unmatched one is worth being able to look up later.
        crewCode: crew.value,
        assignedAt: context.now,
        assignedByUserId: context.actorUserId,
      });
    }
  }

  return { assets, parts, workOrders, workOrderAssignments };
}
