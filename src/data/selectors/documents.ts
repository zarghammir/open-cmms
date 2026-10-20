import type { DemoData } from "@/data/seed";
import type { DocumentRecord } from "@/domain/types";
import { textFor } from "@/lib/localized-text";

/**
 * What a document is filed against, as an answer rather than a blank.
 *
 * Five states, not two. A document belongs to an asset, an order, a plan or a
 * site; **or to the organisation**, which is a real answer — a contract is not
 * about one machine; **or it names a record this system does not hold**, which
 * is neither of those and must not be quietly drawn as either. The library
 * counts and names all of them, because a row that renders an empty cell for
 * the last two tells a reader the document is filed against nothing when one of
 * them means the opposite.
 */
export type FiledAgainst =
  | { state: "asset"; label: string }
  | { state: "workOrder"; label: string }
  | { state: "maintenancePlan"; label: string }
  | { state: "facility"; label: string }
  | { state: "organisation" }
  | { state: "unresolved"; label: string };

/** The short name a reader uses for a file type. */
export type FileTypeKey = "pdf" | "word" | "excel" | "other";

export function fileTypeOf(mimeType: string): FileTypeKey {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("word")) return "word";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return "excel";
  }
  // Not "pdf by default". A type this system does not name is its own answer,
  // and the upload refuses it — so seeing `other` in the library means a record
  // arrived by some path the upload does not guard, which is worth seeing.
  return "other";
}

export interface DocumentRow {
  id: string;
  title: string;
  kind: DocumentRecord["kind"];
  fileName: string;
  fileType: FileTypeKey;
  sizeBytes: number;
  version: number;
  uploadedAt: string;
  filedAgainst: FiledAgainst;
}

function filedAgainst(data: DemoData, document: DocumentRecord): FiledAgainst {
  if (document.assetId !== null) {
    const asset = data.assets.find((one) => one.id === document.assetId);
    return asset
      ? { state: "asset", label: asset.assetTag }
      : { state: "unresolved", label: document.assetId };
  }
  if (document.workOrderId !== null) {
    const order = data.workOrders.find(
      (one) => one.id === document.workOrderId,
    );
    return order
      ? { state: "workOrder", label: order.number }
      : { state: "unresolved", label: document.workOrderId };
  }
  if (document.maintenancePlanId !== null) {
    const plan = data.maintenancePlans.find(
      (one) => one.id === document.maintenancePlanId,
    );
    return plan
      ? { state: "maintenancePlan", label: plan.code }
      : { state: "unresolved", label: document.maintenancePlanId };
  }
  if (document.facilityId !== null) {
    const facility = data.facilities.find(
      (one) => one.id === document.facilityId,
    );
    return facility
      ? { state: "facility", label: facility.code }
      : { state: "unresolved", label: document.facilityId };
  }
  return { state: "organisation" };
}

/** Every document, newest first, with its links resolved to names. */
export function documentRows(data: DemoData, locale: string): DocumentRow[] {
  return [...data.documents]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((document) => ({
      id: document.id,
      title: textFor(document.title, locale),
      kind: document.kind,
      fileName: document.fileName,
      fileType: fileTypeOf(document.mimeType),
      sizeBytes: document.sizeBytes,
      version: document.version,
      uploadedAt: document.uploadedAt,
      filedAgainst: filedAgainst(data, document),
    }));
}

/** Title, file name and what it is filed against — what a person would type. */
export function matchesSearch(row: DocumentRow, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;
  const against =
    row.filedAgainst.state === "organisation" ? "" : row.filedAgainst.label;
  return [row.title, row.fileName, against].some((value) =>
    value.toLowerCase().includes(needle),
  );
}
