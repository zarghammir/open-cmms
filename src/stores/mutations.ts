import type { Role } from "@/domain/constants/roles";
import type { DemoData } from "@/data/seed";
import type {
  AuditAction,
  AuditEvent,
  EntityName,
  FieldChange,
  Id,
  IsoDateTime,
} from "@/domain/types";

/**
 * One description of a change, and one place that applies it.
 *
 * Repositories never write to the store. They describe what they want done and
 * hand it here, which is why an audit entry cannot be forgotten: it is written
 * in the same step as the change, not by a caller who remembered to.
 *
 * It is also where WA-15's offline outbox goes. Queuing a change while offline
 * and replaying it on reconnect means appending this same description to a
 * list — one function, no repository or screen touched.
 */

/** The collections a mutation can address: the list-shaped parts of the data. */
export type CollectionName = {
  [K in keyof DemoData]: DemoData[K] extends readonly unknown[] ? K : never;
}[keyof DemoData];

export interface MutationAudit {
  entity: EntityName;
  action: AuditAction;
  /** A key in both catalogues, with its arguments. Never a built sentence. */
  summaryKey: string;
  summaryParams: Record<string, string | number>;
  changes?: readonly FieldChange[];
}

export interface Actor {
  userId: Id;
  role: Role;
}

export type Mutation =
  | {
      operation: "insert";
      collection: CollectionName;
      id: Id;
      record: Record<string, unknown>;
      actor: Actor;
      audit: MutationAudit;
    }
  | {
      operation: "update";
      collection: CollectionName;
      id: Id;
      changes: Record<string, unknown>;
      actor: Actor;
      audit: MutationAudit;
    }
  | {
      operation: "remove";
      collection: CollectionName;
      id: Id;
      actor: Actor;
      audit: MutationAudit;
    };

/** Raised when a mutation names a record that is not there. */
export class RecordNotFoundError extends Error {
  constructor(
    readonly collection: CollectionName,
    readonly id: Id,
  ) {
    super(`No ${collection} with id ${id}`);
    this.name = "RecordNotFoundError";
  }
}

interface Identified {
  id: Id;
}

/**
 * Applies a mutation and its audit entry together, returning new data.
 *
 * The casts are contained here on purpose: a single function that knows every
 * collection has the same shape — a list of records with an `id` — is simpler
 * to read and to test than the same logic repeated per entity, and no caller
 * ever sees an `unknown`.
 */
export function applyMutation(
  data: DemoData,
  mutation: Mutation,
  at: IsoDateTime,
  auditId: Id,
): DemoData {
  const moved = applyRecordChange(data, mutation);

  const event: AuditEvent = {
    id: auditId,
    organizationId: data.organization.id,
    at,
    actorKind: "person",
    actorUserId: mutation.actor.userId,
    actorRole: mutation.actor.role,
    entity: mutation.audit.entity,
    entityId: mutation.id,
    action: mutation.audit.action,
    summaryKey: mutation.audit.summaryKey,
    summaryParams: mutation.audit.summaryParams,
    changes: mutation.audit.changes ?? [],
  };

  return {
    ...moved,
    // Newest first, the order the trail is read in.
    auditEvents: [event, ...data.auditEvents],
  } as DemoData;
}

/**
 * Applies many changes as one, under a single audit entry.
 *
 * An import is one act. Committing it a row at a time would write hundreds of
 * trail entries for something a person did once, and — worse — would leave the
 * records half-changed if row two hundred were refused. Every change is applied
 * to a working copy here, so a throw escapes before the caller has anything to
 * store: the records are either all moved or untouched, with nothing in between.
 */
export function applyMutations(
  data: DemoData,
  mutations: readonly Mutation[],
  audit: MutationAudit,
  actor: Actor,
  entityId: Id,
  at: IsoDateTime,
  auditId: Id,
): DemoData {
  const moved = mutations.reduce(
    (working, mutation) => applyRecordChange(working, mutation),
    data,
  );

  const event: AuditEvent = {
    id: auditId,
    organizationId: data.organization.id,
    at,
    actorKind: "person",
    actorUserId: actor.userId,
    actorRole: actor.role,
    entity: audit.entity,
    entityId,
    action: audit.action,
    summaryKey: audit.summaryKey,
    summaryParams: audit.summaryParams,
    changes: audit.changes ?? [],
  };

  return {
    ...moved,
    auditEvents: [event, ...data.auditEvents],
  } as DemoData;
}

/** The record half of a mutation, with no trail entry. */
function applyRecordChange(data: DemoData, mutation: Mutation): DemoData {
  const collection = data[mutation.collection] as readonly Identified[];

  let next: readonly Identified[];

  switch (mutation.operation) {
    case "insert": {
      if (collection.some((record) => record.id === mutation.id)) {
        throw new Error(
          `${mutation.collection} already holds id ${mutation.id}`,
        );
      }
      next = [...collection, { ...mutation.record, id: mutation.id }];
      break;
    }
    case "update": {
      if (!collection.some((record) => record.id === mutation.id)) {
        throw new RecordNotFoundError(mutation.collection, mutation.id);
      }
      next = collection.map((record) =>
        record.id === mutation.id ? { ...record, ...mutation.changes } : record,
      );
      break;
    }
    case "remove": {
      if (!collection.some((record) => record.id === mutation.id)) {
        throw new RecordNotFoundError(mutation.collection, mutation.id);
      }
      next = collection.filter((record) => record.id !== mutation.id);
      break;
    }
  }

  return {
    ...data,
    [mutation.collection]: next,
  } as DemoData;
}

/** The change list for an update, for the audit entry. */
export function fieldChanges(
  before: Record<string, unknown>,
  changes: Record<string, unknown>,
): FieldChange[] {
  return Object.entries(changes)
    .filter(([field, to]) => before[field] !== to)
    .map(([field, to]) => ({ field, from: before[field], to }));
}
