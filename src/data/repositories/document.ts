import {
  isAcceptedMimeType,
  type DocumentKind,
  type DocumentRecord,
  type Id,
} from "@/domain/types";
import type { Actor } from "@/stores/mutations";
import { freeId } from "./ids";
import type { RepositoryContext } from "./types";

/**
 * Document metadata across every record a document can be filed against.
 *
 * Phase 1 stores no bytes — the record, not the file — and the screens say so
 * rather than offering a download they cannot honour. WA-10 wrote the read-only
 * half of this (`forAsset`); WA-21 extends it rather than forking a second one.
 *
 * **Filed against nothing is a real answer.** A contract or a policy belongs to
 * the organisation, not to one machine, and `forOrganisation` is how those are
 * reached. Without it they would be unreachable by construction — present in
 * the data, absent from every screen — which is worse than missing, because
 * nothing ever reports it.
 */

/** What the caller knows about a file it has just read in the browser. */
export interface UploadRequest {
  title: { en: string; fr: string };
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  assetId?: Id | null;
  workOrderId?: Id | null;
  facilityId?: Id | null;
  maintenancePlanId?: Id | null;
  /** The document this one replaces, when it is a new version of one. */
  previousVersionId?: Id | null;
}

/**
 * Raised when a file's type is not one this system takes.
 *
 * A named refusal rather than a dropped write: the screen turns this into a
 * sentence naming the type, and a refusal nobody can see is indistinguishable
 * from being ignored.
 */
export class UnsupportedFileTypeError extends Error {
  constructor(readonly mimeType: string) {
    super(`Unsupported file type: ${mimeType}`);
    this.name = "UnsupportedFileTypeError";
  }
}

export interface DocumentRepository {
  /** Documents filed against one asset, newest first. */
  forAsset: (assetId: Id) => DocumentRecord[];
  /** Documents filed against one work order, newest first. */
  forWorkOrder: (workOrderId: Id) => DocumentRecord[];
  /** Documents filed against one maintenance plan, newest first. */
  forPlan: (maintenancePlanId: Id) => DocumentRecord[];
  /**
   * Documents filed against the organisation and nothing else.
   *
   * Every target null: a contract, a policy, something that is not about one
   * machine. They are counted and named, never dropped.
   */
  forOrganisation: () => DocumentRecord[];
  /** Everything, newest first. The library's own list. */
  list: () => DocumentRecord[];
  byId: (id: Id) => DocumentRecord | undefined;
  /**
   * This document and everything it replaced, newest first.
   *
   * Walks `previousVersionId`. A document that replaced nothing is a chain of
   * one, which is a different answer from "no history" and reads the same way
   * on screen: one row, which is the whole history there is.
   */
  versionsOf: (id: Id) => DocumentRecord[];
  /**
   * Records a file somebody chose, without storing a byte of it.
   *
   * Throws `UnsupportedFileTypeError` for a type this system does not take.
   * The screen checks first so it can say so in the reader's language; this
   * check is the one that cannot be bypassed by a second surface arriving
   * later with its own upload button.
   */
  upload: (request: UploadRequest, actor: Actor) => DocumentRecord;
}

export function createDocumentRepository(
  context: RepositoryContext,
): DocumentRepository {
  const newestFirst = (a: DocumentRecord, b: DocumentRecord) =>
    b.uploadedAt.localeCompare(a.uploadedAt);

  const all = () => [...context.data.documents].sort(newestFirst);

  const filed = (match: (document: DocumentRecord) => boolean) =>
    context.data.documents.filter(match).sort(newestFirst);

  const byId = (id: Id) =>
    context.data.documents.find((document) => document.id === id);

  return {
    forAsset: (assetId) => filed((document) => document.assetId === assetId),

    forWorkOrder: (workOrderId) =>
      filed((document) => document.workOrderId === workOrderId),

    forPlan: (maintenancePlanId) =>
      filed((document) => document.maintenancePlanId === maintenancePlanId),

    forOrganisation: () =>
      filed(
        (document) =>
          document.assetId === null &&
          document.workOrderId === null &&
          document.facilityId === null &&
          document.maintenancePlanId === null,
      ),

    list: all,
    byId,

    versionsOf: (id) => {
      const chain: DocumentRecord[] = [];
      /*
       * Bounded by the number of documents, not by trust.
       *
       * A chain is data, and data can be circular — a record pointing at
       * something that points back at it would spin here for ever and take the
       * screen with it. The seen set ends that in one step, and the walk stops
       * at a link that names a document which is not there rather than
       * treating the missing one as the end of the line.
       */
      const seen = new Set<Id>();
      let current = byId(id);
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.push(current);
        current =
          current.previousVersionId === null
            ? undefined
            : byId(current.previousVersionId);
      }
      return chain;
    },

    upload(request, actor) {
      if (!isAcceptedMimeType(request.mimeType)) {
        throw new UnsupportedFileTypeError(request.mimeType);
      }

      const at = context.now().toISOString();
      const previous =
        request.previousVersionId === undefined ||
        request.previousVersionId === null
          ? null
          : byId(request.previousVersionId);

      const document: DocumentRecord = {
        id: freeId(context.data.documents, `doc-live-${at}`),
        organizationId: context.data.organization.id,
        title: request.title,
        kind: request.kind,
        fileName: request.fileName,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        // A new version counts on from the one it replaces. A document that
        // replaces nothing is version 1, never 0: there is no zeroth copy of a
        // file somebody is holding.
        version: previous ? previous.version + 1 : 1,
        uploadedAt: at,
        uploadedByUserId: actor.userId,
        assetId: request.assetId ?? null,
        workOrderId: request.workOrderId ?? null,
        facilityId: request.facilityId ?? null,
        maintenancePlanId: request.maintenancePlanId ?? null,
        previousVersionId: previous ? previous.id : null,
      };

      context.commit(
        {
          operation: "insert",
          collection: "documents",
          id: document.id,
          record: { ...document },
          actor,
          audit: {
            entity: "document",
            action: "created",
            summaryKey: "audit.documentUploaded",
            summaryParams: {
              fileName: document.fileName,
              version: document.version,
            },
          },
        },
        at,
      );

      return document;
    },
  };
}
