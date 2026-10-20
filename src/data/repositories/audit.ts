import type { AuditEvent, EntityName, Id } from "@/domain/types";
import type { RepositoryContext } from "./types";

export interface AuditRepository {
  /** Newest first. `limit` is a page size, not a promise that there is no more. */
  recent: (limit?: number) => AuditEvent[];
  forEntity: (entity: EntityName, entityId: Id) => AuditEvent[];
  count: () => number;
}

export function createAuditRepository(
  context: RepositoryContext,
): AuditRepository {
  const all = () => context.data.auditEvents;

  return {
    recent: (limit = 50) => all().slice(0, limit),
    forEntity: (entity, entityId) =>
      all().filter(
        (event) => event.entity === entity && event.entityId === entityId,
      ),
    count: () => all().length,
  };
}
