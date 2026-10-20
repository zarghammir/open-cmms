import { isBelowMinimum } from "@/domain/constants/part";
import { freeId } from "./ids";
import type { Id, Part } from "@/domain/types";
import type { Actor, Mutation, MutationAudit } from "@/stores/mutations";
import type { RepositoryContext } from "./types";

export interface PartRepository {
  list: (facilityId?: Id) => Part[];
  byId: (id: Id) => Part | undefined;
  byNumber: (partNumber: string) => Part | undefined;
  belowMinimum: (facilityId?: Id) => Part[];
  /** Takes stock out against a work order, and records the movement. */
  issue: (
    partId: Id,
    quantity: number,
    workOrderId: Id | null,
    actor: Actor,
  ) => Part;
  /**
   * Sets stock to what was counted on the shelf during an inventory
   * verification, and records the difference.
   *
   * Separate from `issue` because it answers to a different question. Issuing
   * knows how much left and why; a verification knows only what is there now,
   * and the movement it writes can go either way.
   *
   * A count that agrees with the record writes nothing at all: confirming a
   * number is not a stock movement, and a shelf of zero-quantity transactions
   * would bury the discrepancies that matter.
   */
  adjust: (
    partId: Id,
    countedQuantity: number,
    actor: Actor,
    note?: string | null,
  ) => Part;
}

/**
 * The notice a movement owes, or nothing at all.
 *
 * **Once per downward crossing, not once per movement while low.** The rule is
 * the whole of `was >= minimum && now < minimum`, and both halves earn their
 * place: a second issue against an already-low part has `was` below the minimum
 * and writes nothing, so a store that is short of filters does not produce a
 * notice every time somebody takes one; and a receipt that lifts stock back
 * over the line writes nothing either, because `now` is not below it.
 *
 * Addressed to a role rather than a person. A part below its minimum is not
 * news for whoever happened to take the last one — it is for whoever reorders,
 * and `maintenanceCoordinator` is the role that holds `inventory.adjust` and
 * runs the verification.
 *
 * It returns the mutation instead of committing it so that both callers can put
 * it in the *same* commit as the movement. The count, the movement and the
 * notice are one act: a queue that could carry the new count without the notice
 * explaining it is the thing `commitMany` exists to prevent.
 */
function noticeForCrossing(
  notifications: readonly { id: Id }[],
  part: Part,
  was: number,
  now: number,
  at: string,
  actor: Actor,
  audit: MutationAudit,
): Mutation | null {
  if (isBelowMinimum(part, was) || !isBelowMinimum(part, now)) return null;

  return {
    operation: "insert",
    collection: "notifications",
    /*
     * Asked of the collection, not built from the clock.
     *
     * This shipped as `ntf-low-${part.partNumber}-${at}` — WA-57's defect
     * exactly, a hundred and twenty lines above two `freeId` calls in this same
     * file that get it right. It is reachable: a count that crosses below the
     * minimum, one that puts stock back over it, and a third that crosses again
     * are three ordinary acts, and inside one millisecond the third threw
     * `notifications already holds id ntf-low-FLT-202-…`. The storekeeper would
     * have been told their *count* was refused, which is untrue and entirely
     * believable — the same lie `adjust` was singled out for in WA-57.
     */
    id: freeId(notifications, `ntf-low-${part.partNumber}-${at}`),
    record: {
      organizationId: part.organizationId,
      kind: "partBelowMinimum",
      messageKey: "notifications.partBelowMinimum",
      params: { partNumber: part.partNumber, onHand: now },
      subject: { entity: "part", id: part.id },
      createdAt: at,
      readAt: null,
      forUserId: null,
      forRole: "maintenanceCoordinator",
    },
    actor,
    /*
     * The act's own audit, not a key of its own.
     *
     * `commitMany` writes one entry for the batch, and the entry that belongs
     * there is the thing a person did — issued a part, or counted a shelf.
     * "Fell below its minimum" is a consequence of that act rather than a
     * second act, and giving it a key would put a sentence in the trail that
     * no screen renders and that nobody performed. `assign` gives its own
     * notification the order's audit for the same reason.
     *
     * The crossing is not lost by this: it is the notification record, which
     * is what the reader actually needs and what this ticket adds.
     */
    audit,
  };
}

export function createPartRepository(
  context: RepositoryContext,
): PartRepository {
  const all = () => context.data.parts;

  return {
    list: (facilityId) =>
      facilityId
        ? all().filter((part) => part.facilityId === facilityId)
        : all(),

    byId: (id) => all().find((part) => part.id === id),

    /*
     * Trimmed and case-folded, the way `workOrders.byNumber` already is.
     *
     * It matched exactly before, and the three callers do not all hand it a
     * tidy string: a scanned code arrives as whatever was printed, and a stock
     * number typed into a URL arrives as whatever was typed. Normalising here
     * rather than at each caller is the repository's own rule — trimming and
     * case live where nothing can route around them, or the next caller is the
     * one that forgets.
     */
    byNumber(partNumber) {
      const wanted = partNumber.trim().toUpperCase();
      if (wanted.length === 0) return undefined;
      return all().find((part) => part.partNumber.toUpperCase() === wanted);
    },

    belowMinimum: (facilityId) =>
      all().filter(
        (part) =>
          isBelowMinimum(part, part.quantityOnHand) &&
          (!facilityId || part.facilityId === facilityId),
      ),

    issue(partId, quantity, workOrderId, actor) {
      const part = all().find((candidate) => candidate.id === partId);
      if (!part) {
        throw new Error(`No part with id ${partId}`);
      }
      if (quantity <= 0) {
        throw new Error("Issuing takes a positive quantity");
      }
      if (quantity > part.quantityOnHand) {
        throw new Error(
          `Only ${part.quantityOnHand} of ${part.partNumber} on hand`,
        );
      }

      const at = context.now().toISOString();
      const remaining = part.quantityOnHand - quantity;
      const audit: MutationAudit = {
        entity: "part",
        action: "updated",
        summaryKey: "audit.partIssued",
        summaryParams: { partNumber: part.partNumber, quantity },
        changes: [
          { field: "quantityOnHand", from: part.quantityOnHand, to: remaining },
        ],
      };
      const notice = noticeForCrossing(
        context.data.notifications,
        part,
        part.quantityOnHand,
        remaining,
        at,
        actor,
        audit,
      );

      /*
       * One act, one entry. Taking stock out moves the count and writes the
       * movement that explains it, and a person did one thing — so it is one
       * line in the trail and one place in the offline queue. As two commits it
       * was two of each, and the second could in principle be queued without
       * the first.
       *
       * The two records are also only meaningful together: a count that dropped
       * with no movement behind it is exactly the thing a stock trail exists to
       * make impossible.
       */
      context.commitMany(
        [
          {
            operation: "update",
            collection: "parts",
            id: partId,
            changes: { quantityOnHand: remaining },
            actor,
            audit,
          },
          {
            operation: "insert",
            collection: "inventoryTransactions",
            id: freeId(
              context.data.inventoryTransactions,
              `inv-live-${at}-${part.partNumber}`,
            ),
            record: {
              organizationId: part.organizationId,
              partId,
              kind: "issue",
              quantity: -quantity,
              at,
              byUserId: actor.userId,
              workOrderId,
              note: null,
            },
            actor,
            audit: {
              entity: "inventoryTransaction",
              action: "created",
              summaryKey: "audit.partIssued",
              summaryParams: { partNumber: part.partNumber, quantity },
            },
          },
          // Third only when the movement crossed the line; `commitMany` takes
          // one audit for the batch, so this stays one act and one entry.
          ...(notice ? [notice] : []),
        ],
        audit,
        actor,
        partId,
        at,
      );

      return { ...part, quantityOnHand: remaining };
    },

    adjust(partId, countedQuantity, actor, note = null) {
      const part = all().find((candidate) => candidate.id === partId);
      if (!part) {
        throw new Error(`No part with id ${partId}`);
      }
      if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
        throw new Error("A counted quantity is a whole number, zero or more");
      }

      const difference = countedQuantity - part.quantityOnHand;
      if (difference === 0) {
        return part;
      }

      const at = context.now().toISOString();
      const audit: MutationAudit = {
        entity: "part",
        action: "updated",
        summaryKey: "audit.partAdjusted",
        summaryParams: {
          partNumber: part.partNumber,
          from: part.quantityOnHand,
          to: countedQuantity,
        },
        changes: [
          {
            field: "quantityOnHand",
            from: part.quantityOnHand,
            to: countedQuantity,
          },
        ],
      };
      const notice = noticeForCrossing(
        context.data.notifications,
        part,
        part.quantityOnHand,
        countedQuantity,
        at,
        actor,
        audit,
      );

      /*
       * One act, one entry — the shape `issue` already had.
       *
       * This was two `commit` calls, so a shelf count wrote two lines in the
       * trail and took two places in the offline queue for one thing a person
       * did, and the second could in principle be queued without the first. A
       * count that moved with no movement explaining it is exactly what a stock
       * trail exists to make impossible, and adding the low-stock notice as a
       * third separate commit would have made it three.
       */
      context.commitMany(
        [
          {
            operation: "update",
            collection: "parts",
            id: partId,
            changes: { quantityOnHand: countedQuantity },
            actor,
            audit,
          },
          {
            operation: "insert",
            collection: "inventoryTransactions",
            id: freeId(
              context.data.inventoryTransactions,
              `inv-count-${at}-${part.partNumber}`,
            ),
            record: {
              organizationId: part.organizationId,
              partId,
              kind: "adjustment",
              quantity: difference,
              at,
              byUserId: actor.userId,
              workOrderId: null,
              note,
            },
            actor,
            audit: {
              entity: "inventoryTransaction",
              action: "created",
              summaryKey: "audit.partAdjusted",
              summaryParams: {
                partNumber: part.partNumber,
                from: part.quantityOnHand,
                to: countedQuantity,
              },
            },
          },
          ...(notice ? [notice] : []),
        ],
        audit,
        actor,
        partId,
        at,
      );

      return { ...part, quantityOnHand: countedQuantity };
    },
  };
}
