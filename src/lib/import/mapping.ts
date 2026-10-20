/**
 * Which spreadsheet column feeds which WorkAxis field.
 *
 * Nothing here touches React, the store or a file. Mapping and validation are
 * the parts of an import that have to be right, so they are plain functions
 * over plain data and are tested without a browser.
 */

export const SHEET_KINDS = ["equipment", "inventory", "workOrders"] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

/** A field the import can fill. `key` is also its catalogue key. */
export interface TargetField {
  key: string;
  required: boolean;
  /**
   * Legacy headers that mean this field. Matching is by table rather than by
   * resemblance: `EQUIP_NO` and `assetTag` have no letters in common, so any
   * "clever" similarity check would be guessing.
   */
  aliases: readonly string[];
}

/**
 * Two columns are deliberately absent from the alias tables: `CRITICALITY` and
 * `MIN_QTY`. That is not an oversight and not a contrivance for the
 * demonstration — MP2 installations name those two differently from site to
 * site (`CRIT`, `PRIORITY`, `REORDER_PT`, `MIN_STOCK`), so a table built from
 * what the common exports look like genuinely does not cover them. They are
 * exactly the case the mapping step exists for, and they are the two a person
 * maps by hand.
 */
export const TARGET_FIELDS: Record<SheetKind, readonly TargetField[]> = {
  equipment: [
    {
      key: "assetTag",
      required: true,
      aliases: ["EQUIP_NO", "EQUIPNO", "EQUIPMENT_NO", "ASSET_NO"],
    },
    {
      key: "name",
      required: true,
      aliases: ["EQUIP_DESC", "DESCRIPTION", "EQUIPMENT_DESC"],
    },
    {
      key: "locationCode",
      required: true,
      aliases: ["LOCATION", "LOC", "LOCATION_CODE"],
    },
    {
      key: "manufacturer",
      required: false,
      aliases: ["MFG", "MANUFACTURER", "MAKE"],
    },
    { key: "model", required: false, aliases: ["MODEL", "MODEL_NO"] },
    {
      key: "serialNumber",
      required: false,
      aliases: ["SERIAL_NO", "SERIAL", "SERIALNO"],
    },
    {
      key: "installedAt",
      required: false,
      aliases: ["INSTALL_DATE", "INSTALLED", "INSTALL_DT"],
    },
    { key: "status", required: false, aliases: ["STATUS", "EQUIP_STATUS"] },
    { key: "criticality", required: false, aliases: [] },
  ],
  inventory: [
    {
      key: "partNumber",
      required: true,
      aliases: ["STOCK_NO", "STOCKNO", "PART_NO", "ITEM_NO"],
    },
    {
      key: "name",
      required: true,
      aliases: ["DESCRIPTION", "PART_DESC", "ITEM_DESC"],
    },
    {
      key: "quantityOnHand",
      required: true,
      aliases: ["QTY_ON_HAND", "QTY", "ON_HAND", "QOH"],
    },
    { key: "reorderPoint", required: false, aliases: [] },
    {
      key: "unitCost",
      required: false,
      aliases: ["UNIT_COST", "COST", "PRICE"],
    },
    {
      key: "binCode",
      required: true,
      aliases: ["BIN", "BIN_NO", "BIN_LOCATION"],
    },
  ],
  workOrders: [
    {
      key: "number",
      required: true,
      aliases: ["WO_NO", "WONO", "WORK_ORDER_NO", "WO_NUM"],
    },
    {
      key: "assetTag",
      required: true,
      aliases: ["EQUIP_NO", "EQUIPNO", "ASSET_NO"],
    },
    { key: "type", required: false, aliases: ["WO_TYPE", "TYPE", "WORK_TYPE"] },
    { key: "priority", required: false, aliases: ["PRIORITY", "PRIO"] },
    {
      key: "requestedAt",
      required: true,
      aliases: ["DATE_REQUESTED", "REQ_DATE", "DATE_REQ"],
    },
    {
      key: "dueAt",
      required: false,
      aliases: ["DATE_DUE", "DUE_DATE", "SCHED_DATE"],
    },
    {
      key: "completedAt",
      required: false,
      aliases: ["DATE_COMPLETED", "COMP_DATE", "DATE_COMP"],
    },
    { key: "status", required: false, aliases: ["STATUS", "WO_STATUS"] },
    {
      key: "crewCode",
      required: false,
      aliases: ["ASSIGNED_TO", "ASSIGNEE", "CREW", "TECH"],
    },
    {
      key: "description",
      required: true,
      aliases: ["DESCRIPTION", "WO_DESC", "WORK_DESC"],
    },
  ],
};

/** Sheet names a legacy export uses, lower-cased. */
const SHEET_ALIASES: Record<SheetKind, readonly string[]> = {
  equipment: ["equipment", "equip", "assets", "asset"],
  inventory: ["inventory", "parts", "stock", "storeroom"],
  workOrders: ["workorders", "work orders", "work_orders", "wo", "workorder"],
};

function normalise(header: string): string {
  return header
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/** Which of our three sheets a tab is, or null when we cannot tell. */
export function sheetKindFor(sheetName: string): SheetKind | null {
  const name = sheetName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  for (const kind of SHEET_KINDS) {
    if (
      SHEET_ALIASES[kind].some(
        (alias) => alias.replace(/[\s_-]+/g, "") === name,
      )
    ) {
      return kind;
    }
  }
  return null;
}

/** field key -> column header, for the columns we could place confidently. */
export type ColumnMapping = Record<string, string | undefined>;

/**
 * Suggests a mapping, and says nothing about the columns it cannot place.
 *
 * A column with no confident target is left out rather than attached to the
 * closest-looking field. A wrong mapping imports real data into the wrong
 * column and is far more expensive than asking.
 */
export function suggestMapping(
  kind: SheetKind,
  headers: readonly string[],
): ColumnMapping {
  const present = new Map(headers.map((header) => [normalise(header), header]));
  const mapping: ColumnMapping = {};
  const taken = new Set<string>();

  for (const field of TARGET_FIELDS[kind]) {
    for (const alias of field.aliases) {
      const header = present.get(normalise(alias));
      if (header !== undefined && !taken.has(header)) {
        mapping[field.key] = header;
        taken.add(header);
        break;
      }
    }
  }

  return mapping;
}

/** Required fields with no column behind them. The import cannot start. */
export function unmappedRequired(
  kind: SheetKind,
  mapping: ColumnMapping,
): string[] {
  return TARGET_FIELDS[kind]
    .filter((field) => field.required && !mapping[field.key])
    .map((field) => field.key);
}

/** Fields with no column yet, required or not — what the mapping step shows. */
export function unmappedFields(
  kind: SheetKind,
  mapping: ColumnMapping,
): string[] {
  return TARGET_FIELDS[kind]
    .filter((field) => !mapping[field.key])
    .map((field) => field.key);
}

/** Columns in the file that no field claims. Kept, so a person can place them. */
export function unclaimedColumns(
  headers: readonly string[],
  mapping: ColumnMapping,
): string[] {
  const claimed = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((header) => !claimed.has(header));
}
