import type { Role } from "@/domain/constants/roles";
import type { EntityName, Id, IsoDateTime, TenantOwned } from "./common";

export const AUDIT_ACTIONS = [
  "created",
  "updated",
  "statusChanged",
  "assigned",
  "completed",
  "cancelled",
  "deleted",
  "imported",
  "demoReset",
  "rebuilt",
  // Taking data out is an act in its own right: nothing changes, and the trail
  // still has to be able to say somebody left with a file.
  "exported",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/**
 * Who an entry is attributed to.
 *
 * Two shapes rather than two optional fields, because "the application did it"
 * and "a person did it" are different answers and a trail that blurs them is
 * worth less than one that says nothing. A system entry cannot carry an invented
 * user or an invented role — there is nowhere to put them — and a person entry
 * cannot omit either.
 *
 * There is a third answer, and it is deliberately not here: an entry naming a
 * person the records no longer hold is *unattributed*, which is a fact about
 * reading the trail rather than about writing it. `recentActivity` decides that
 * one, because only a reader can know whether a name resolves.
 */
export type AuditActor =
  | { actorKind: "person"; actorUserId: Id; actorRole: Role }
  | { actorKind: "system" };

/**
 * One line in the trail. Written by the store on every mutation, in the same
 * commit as the change itself, so a change cannot exist without its entry.
 *
 * `summaryKey` and `summaryParams` are a catalogue key and its arguments. An
 * English sentence stored here would still be English in the French demo and
 * could never be corrected afterwards.
 */
export type AuditEvent = TenantOwned &
  AuditActor & {
    id: Id;
    at: IsoDateTime;
    entity: EntityName;
    entityId: Id;
    action: AuditAction;
    summaryKey: string;
    summaryParams: Record<string, string | number>;
    changes: readonly FieldChange[];
  };
