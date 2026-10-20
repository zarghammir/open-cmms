import {
  readCode,
  readDecimal,
  readInteger,
  readIsoDate,
  readText,
  siteOf,
} from "./coerce";
import { TARGET_FIELDS, type ColumnMapping, type SheetKind } from "./mapping";

/**
 * What the validation report is made of.
 *
 * An issue names a sheet, a row, a column and a reason — the same coordinates
 * the fixture's data dictionary uses, so a reviewer can hold the two side by
 * side. `code` is a catalogue key, never a sentence: a report written in
 * English in September still has to read in French in October.
 */

export const ISSUE_CODES = [
  "missingRequired",
  "duplicateKey",
  "unknownAsset",
  "unreadableDate",
  "completedInFuture",
  "negativeQuantity",
  "unknownSite",
  "notANumber",
  "unmatchedCrewCode",
  "cancelledWithoutReason",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

/**
 * Blocking means the row cannot become a record: there is no asset to hang it
 * on, no name to call it, nowhere to put it. Recoverable means the row imports
 * and something about it is worth saying out loud.
 */
export const BLOCKING_CODES: readonly IssueCode[] = [
  "missingRequired",
  "unknownAsset",
  "unknownSite",
];

export type IssueSeverity = "blocking" | "recoverable";

export function severityOf(code: IssueCode): IssueSeverity {
  return BLOCKING_CODES.includes(code) ? "blocking" : "recoverable";
}

export interface ImportIssue {
  sheet: SheetKind;
  /** Spreadsheet row number: the header is row 1, so data starts at 2. */
  row: number;
  column: string;
  code: IssueCode;
  severity: IssueSeverity;
  params: Record<string, string | number>;
}

export interface SheetData {
  kind: SheetKind;
  headers: readonly string[];
  rows: readonly (readonly unknown[])[];
}

export interface ValidationContext {
  /** ISO day. Passed in rather than read, so the same file validates the same way twice. */
  today: string;
  knownSiteCodes: readonly string[];
  knownLocationCodes: readonly string[];
  knownBinCodes: readonly string[];
  knownCrewCodes: readonly string[];
  existingAssetTags: readonly string[];
  existingPartNumbers: readonly string[];
  existingWorkOrderNumbers: readonly string[];
}

export interface ValidationResult {
  issues: readonly ImportIssue[];
  /** Rows that will become records, per sheet. Blocking issues remove a row. */
  importable: Record<SheetKind, number>;
  /** Rows a blocking issue keeps out, per sheet. */
  blocked: Record<SheetKind, number>;
}

/** A cell by field name, via the mapping. */
function cellOf(
  headers: readonly string[],
  row: readonly unknown[],
  mapping: ColumnMapping,
  field: string,
): { column: string; value: unknown } | null {
  const column = mapping[field];
  if (!column) return null;
  const index = headers.indexOf(column);
  return index === -1 ? null : { column, value: row[index] };
}

export function validateImport(
  sheets: readonly SheetData[],
  mappings: Record<SheetKind, ColumnMapping>,
  context: ValidationContext,
): ValidationResult {
  const issues: ImportIssue[] = [];
  const importable = { equipment: 0, inventory: 0, workOrders: 0 };
  const blocked = { equipment: 0, inventory: 0, workOrders: 0 };

  // Asset tags this import itself brings, so a work order may point at a piece
  // of equipment that is arriving in the same file rather than one already here.
  const arrivingTags = new Set<string>();
  const equipment = sheets.find((sheet) => sheet.kind === "equipment");
  if (equipment) {
    const mapping = mappings.equipment;
    for (const row of equipment.rows) {
      const tag = cellOf(equipment.headers, row, mapping, "assetTag");
      const reading = readCode(tag?.value);
      if (reading.kind === "value") arrivingTags.add(reading.value);
    }
  }

  for (const sheet of sheets) {
    const mapping = mappings[sheet.kind];
    const seenKeys = new Set<string>();

    sheet.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const rowIssues: ImportIssue[] = [];

      const add = (
        column: string,
        code: IssueCode,
        params: Record<string, string | number> = {},
      ) => {
        rowIssues.push({
          sheet: sheet.kind,
          row: rowNumber,
          column,
          code,
          severity: severityOf(code),
          params,
        });
      };

      // Required fields, for every sheet, from one description.
      for (const field of TARGET_FIELDS[sheet.kind]) {
        if (!field.required) continue;
        const cell = cellOf(sheet.headers, row, mapping, field.key);
        if (!cell) continue;
        if (readText(cell.value).kind === "absent") {
          add(cell.column, "missingRequired", { field: field.key });
        }
      }

      const keyField =
        sheet.kind === "equipment"
          ? "assetTag"
          : sheet.kind === "inventory"
            ? "partNumber"
            : "number";
      const existing =
        sheet.kind === "equipment"
          ? context.existingAssetTags
          : sheet.kind === "inventory"
            ? context.existingPartNumbers
            : context.existingWorkOrderNumbers;

      const keyCell = cellOf(sheet.headers, row, mapping, keyField);
      const key = readCode(keyCell?.value);
      if (keyCell && key.kind === "value") {
        if (seenKeys.has(key.value) || existing.includes(key.value)) {
          add(keyCell.column, "duplicateKey", { value: key.value });
        }
        seenKeys.add(key.value);
      }

      if (sheet.kind === "equipment") {
        const location = cellOf(sheet.headers, row, mapping, "locationCode");
        const code = readCode(location?.value);
        if (location && code.kind === "value") {
          const site = siteOf(code.value);
          if (!context.knownSiteCodes.includes(site)) {
            add(location.column, "unknownSite", { code: code.value, site });
          }
          // Only when the site is real: a location on a site that does not
          // exist is one fault, not two, and reporting it twice makes the
          // report disagree with the dictionary it is read against.
          else if (!context.knownLocationCodes.includes(code.value)) {
            add(location.column, "unknownSite", { code: code.value, site });
          }
        }

        const installed = cellOf(sheet.headers, row, mapping, "installedAt");
        if (installed) {
          const reading = readIsoDate(installed.value);
          if (reading.kind === "unreadable") {
            add(installed.column, "unreadableDate", { raw: reading.raw });
          }
        }
      }

      if (sheet.kind === "inventory") {
        const quantity = cellOf(sheet.headers, row, mapping, "quantityOnHand");
        if (quantity) {
          const reading = readInteger(quantity.value);
          if (reading.kind === "unreadable") {
            add(quantity.column, "notANumber", { raw: reading.raw });
          } else if (reading.kind === "value" && reading.value < 0) {
            add(quantity.column, "negativeQuantity", { value: reading.value });
          }
        }

        const cost = cellOf(sheet.headers, row, mapping, "unitCost");
        if (cost) {
          const reading = readDecimal(cost.value);
          if (reading.kind === "unreadable") {
            add(cost.column, "notANumber", { raw: reading.raw });
          }
        }

        const bin = cellOf(sheet.headers, row, mapping, "binCode");
        const binCode = readCode(bin?.value);
        if (bin && binCode.kind === "value") {
          const site = siteOf(binCode.value);
          if (
            !context.knownSiteCodes.includes(site) ||
            !context.knownBinCodes.includes(binCode.value)
          ) {
            add(bin.column, "unknownSite", { code: binCode.value, site });
          }
        }
      }

      if (sheet.kind === "workOrders") {
        const asset = cellOf(sheet.headers, row, mapping, "assetTag");
        const tag = readCode(asset?.value);
        if (asset && tag.kind === "value") {
          const known =
            arrivingTags.has(tag.value) ||
            context.existingAssetTags.includes(tag.value);
          if (!known) add(asset.column, "unknownAsset", { tag: tag.value });
        }

        for (const field of ["requestedAt", "dueAt", "completedAt"] as const) {
          const cell = cellOf(sheet.headers, row, mapping, field);
          if (!cell) continue;
          const reading = readIsoDate(cell.value);
          if (reading.kind === "unreadable") {
            add(cell.column, "unreadableDate", { raw: reading.raw });
          }
        }

        const status = readCode(
          cellOf(sheet.headers, row, mapping, "status")?.value,
        );
        const completed = cellOf(sheet.headers, row, mapping, "completedAt");
        if (completed && status.kind === "value" && status.value === "COMP") {
          const reading = readIsoDate(completed.value);
          if (reading.kind === "value" && reading.value > context.today) {
            add(completed.column, "completedInFuture", { date: reading.value });
          }
        }

        if (status.kind === "value" && status.value === "CANC") {
          const column = mapping.status ?? "STATUS";
          add(column, "cancelledWithoutReason", {});
        }

        const crew = cellOf(sheet.headers, row, mapping, "crewCode");
        const crewCode = readCode(crew?.value);
        if (crew && crewCode.kind === "value") {
          if (!context.knownCrewCodes.includes(crewCode.value)) {
            add(crew.column, "unmatchedCrewCode", { code: crewCode.value });
          }
        }
      }

      issues.push(...rowIssues);
      const isBlocked = rowIssues.some(
        (issue) => issue.severity === "blocking",
      );
      if (isBlocked) blocked[sheet.kind] += 1;
      else importable[sheet.kind] += 1;
    });
  }

  return { issues, importable, blocked };
}

/** How many rows carry at least one issue, which is what the report counts. */
export function rowsWithIssues(issues: readonly ImportIssue[]): number {
  return new Set(issues.map((issue) => `${issue.sheet}:${issue.row}`)).size;
}

export function issuesByCode(
  issues: readonly ImportIssue[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1;
  }
  return counts;
}
