import type { Id, IsoDateTime, LocalizedText, TenantOwned } from "./common";

/**
 * What a document **is**. Never what it is attached to.
 *
 * The RFP's list — work orders, contracts, standard operating procedures,
 * manufacturer instructions, planned inspection tasks — mixes the two, and
 * putting all five in one enum would make the library's filter answer two
 * questions at once: "show me the SOPs" and "show me everything on this work
 * order" are different questions about different columns.
 *
 * So the RFP's five map like this, and the mapping is stated here rather than
 * left for a reader to reconstruct:
 *
 *   contracts                  -> kind `contract`
 *   standard operating procedures -> kind `procedure`
 *   manufacturer instructions  -> kind `manual`
 *   work orders                -> a target, `workOrderId`
 *   planned inspection tasks   -> a target, deferred to WA-20 by name
 */
export const DOCUMENT_KINDS = [
  "manual",
  "certificate",
  "drawing",
  "procedure",
  "contract",
  "report",
  "photo",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * The file types this system accepts, and the only ones.
 *
 * Office, Excel and PDF, per RFP 4.1.1(b). A type outside this list is refused
 * by name rather than dropped: "that file is not one we take" is a different
 * answer from silence, and silence is the one a person reads as a bug in the
 * upload.
 */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export function isAcceptedMimeType(value: string): value is AcceptedMimeType {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Metadata about a file. Phase 1 stores no bytes: the demo shows the record, the
 * upload simulation and the link, and says so rather than pretending to hold a
 * file it does not have.
 *
 * Named `DocumentRecord` because `Document` is a DOM global and shadowing it in
 * a browser application is a trap.
 */
export interface DocumentRecord extends TenantOwned {
  id: Id;
  title: LocalizedText;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  uploadedAt: IsoDateTime;
  uploadedByUserId: Id;
  /**
   * What this document is filed against. Every one of them may be null, and
   * all of them being null is a real answer rather than a broken record: the
   * document belongs to the organisation — a contract or a policy that is not
   * about one machine. `forOrganisation` is how those are reached, and they
   * are counted and named in the library rather than quietly missing from it.
   */
  assetId: Id | null;
  workOrderId: Id | null;
  facilityId: Id | null;
  maintenancePlanId: Id | null;
  /**
   * The document this one replaced, or null when it is the first of its line.
   *
   * A chain rather than a `versions` array, because a version is a document in
   * its own right: it has its own file, size, uploader and date, and the
   * library lists it like any other. `versionsOf` walks the chain.
   */
  previousVersionId: Id | null;
}
