import { isReadOnly, ROLES, type Role } from "@/domain/constants/roles";
import type { User } from "@/domain/types";

/**
 * Who work can be handed to.
 *
 * **One rule, both surfaces.** A work order's assignee is chosen in two places
 * — the form that raises it and the dialog that hands an existing one over —
 * and until now each filtered the people list for itself. The create form did
 * not filter at all, so it offered the auditor: the one role that may not
 * change anything, presented as a person to give a job to. Assigning them
 * would have written an order nobody could ever complete, and the trail would
 * have said a person was given work they are not allowed to do.
 *
 * **The rule is derived, not a list of roles.** A person can be given work
 * when they can change something at all, which is `isReadOnly` — and the
 * auditor is the only role that holds nothing. Written as a list here, the next
 * role added to the system would be silently absent from one surface and
 * present on the other, which is the shape of the defect this fixes, one layer
 * up.
 *
 * **It was nearly `workOrder.complete`, and a browser test said otherwise.**
 * That reading excludes the inspector too — an inspector completes inspections,
 * not work orders — and it is defensible from `roles.ts` alone. But
 * `assign-order.spec.ts` on main hands an order from a technician to the
 * inspector and asserts it arrives on the inspector's own list, so the product
 * already intends an inspector to be able to hold work; the narrower rule
 * turned that green test red. A passing test about the behaviour beats an
 * inference from the capability table, and the ticket named the auditor alone.
 * If an inspector should not hold work orders, that is a change to make on
 * purpose, with that spec.
 *
 * Inactive people are out too. Somebody who has left is not a person to give
 * tomorrow's job to, and nothing else in the product offers them either.
 */
export function canBeAssignedWork(user: User): boolean {
  return user.active && !isReadOnly(user.role);
}

/** The people a screen may offer, in the order it was given them. */
export function assignablePeople(users: readonly User[]): User[] {
  return users.filter(canBeAssignedWork);
}

/**
 * The roles a screen is leaving out, so it can say so.
 *
 * A list that quietly omits people is a list a reader cannot check. The auditor
 * is missing from the assignee select for a reason, and a coordinator looking
 * for them should be told that reason rather than left to wonder whether the
 * records are broken or the person has left.
 *
 * Roles rather than names: "the Auditor cannot be assigned work" is a rule a
 * reader can carry to the next screen, while a name is a fact about today's
 * demonstration data. Empty when nobody is left out, so the hint disappears
 * rather than saying "nobody is missing".
 */
export function rolesNotAssignable(users: readonly User[]): Role[] {
  const present = new Set(
    users.filter((user) => user.active).map((user) => user.role),
  );
  return ROLES.filter((role) => present.has(role) && isReadOnly(role));
}
