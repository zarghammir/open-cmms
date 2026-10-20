import type { Id, TenantOwned } from "./common";
import type { NotifiableKind } from "./notification";
import type { WorkOrderPriority, WorkOrderStatus } from "./work-order";

/**
 * The rules an administrator may change, and the defaults new people inherit.
 *
 * Both are records rather than settings on the side, for the reason the 16:30
 * ruling gives: they live in `DemoData`, so the demonstration reset restores
 * them like everything else and a repository reaches them through
 * `context.data` rather than through a second mechanism nobody else uses.
 *
 * They are **lists of one and of six** rather than single objects, and that is
 * not a quirk. A mutation addresses a collection and an id, so a singleton
 * object could not be written through `applyMutation` — it would need a second
 * write path, and a second write path is a second place an audit entry can be
 * forgotten. One row per organisation and one row per notification kind are
 * also what Phase 2 would hold anyway.
 */

/** One edge of the status map: where an order may go, and from where. */
export interface TransitionPair {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
}

export interface WorkflowRule extends TenantOwned {
  /** One row per organisation. Phase 1 seeds exactly one. */
  id: Id;

  /**
   * The moves an administrator has switched off.
   *
   * **Subtractive on purpose, and this is the important decision in the file.**
   * The record could have held the allowed map itself, and then an edit could
   * invent an edge the domain forbids — completed back to open, say — which
   * `WORK_ORDER_TRANSITIONS` exists to make impossible and which no screen
   * could be trusted to refuse. Holding what is *turned off* means the
   * effective rule is the map minus this list: an administrator can narrow the
   * flow and can never widen it past what the domain allows.
   *
   * It also gives the screens the distinction they need. A control absent
   * because the order is finished and a control disabled because somebody
   * turned the rule off are different sentences, and only the second one is a
   * rule being shown to a person.
   */
  disabledTransitions: readonly TransitionPair[];

  /**
   * Whether finishing a job takes a note.
   *
   * Seeded **true**, which is what the application already did unconditionally
   * before this was configurable — so a rebuild changes nothing a person can
   * see.
   *
   * Worth saying plainly that turning it off weakens the record, and that the
   * repository's own docblock argues for the note: "completed" with nothing
   * beside it is what a maintenance system is asked about six months later and
   * cannot answer. That argument has not been withdrawn. What has changed is
   * that an administrator may now make that trade for their own organisation,
   * deliberately, and the trail records who did it and when.
   */
  requireCompletionNote: boolean;

  /**
   * How long each priority is meant to take, in hours.
   *
   * **Displayed, not enforced.** Nothing computes a breach, nothing colours a
   * row red, and no notification fires — those belong to a later ticket and
   * are named in this one's Deviations. A number shown beside a priority is an
   * organisation stating its own target, which is worth showing; a number that
   * looked enforced and was not would be worse than no number.
   */
  prioritySlaHours: Record<WorkOrderPriority, number>;
}

/**
 * What a person who has said nothing yet hears about.
 *
 * One row per notifiable kind. WA-18 already gives every person their own
 * preferences; this is the answer for somebody who has never opened that
 * screen, which today is everybody, and it is what an administrator sets for
 * the organisation.
 */
export interface NotificationDefault extends TenantOwned {
  /** The row's id carries its kind: one row per kind, and never two. */
  id: Id;
  kind: NotifiableKind;
  inApp: boolean;
  email: boolean;
}
