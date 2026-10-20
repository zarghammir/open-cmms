import type { DemoData } from "@/data/seed";
import { readsOnly } from "@/domain/constants/role-matrix";
import { ROLES, type Role } from "@/domain/constants/roles";
import type { Facility, User } from "@/domain/types";

/**
 * The people in the organisation, as the administration screen reads them.
 *
 * The user repository answers "which records are there". This answers "how do
 * they read as a list somebody administers": each person beside the site they
 * work out of and what their role lets them do. That is a view of the data
 * rather than a query on it, which is why it lives here.
 *
 * **Nothing here sorts.** The reader's language decides the order of a list of
 * names — "Éthier" belongs before "Evans" in French and after it in a naive
 * comparison — and `createLocaleCompare` in the data table is where that
 * decision already lives. A selector that sorted would be sorting in no
 * particular language, and the table would re-sort on top of it anyway.
 */

export interface PersonRow {
  user: User;
  /**
   * The site this person works out of.
   *
   * **Null means the site did not resolve, never that they have none.**
   * `homeFacilityId` is required, so a person without a readable site is a
   * broken reference and the screen has to say so — "unassigned" would be a
   * different fact, and one this data cannot express.
   */
  facility: Facility | null;
  /** True when this person's role may change nothing at all. */
  readsOnly: boolean;
}

export function peopleList(data: DemoData): PersonRow[] {
  const facilitiesById = new Map(
    data.facilities.map((facility) => [facility.id, facility]),
  );

  return data.users.map((user) => ({
    user,
    facility: facilitiesById.get(user.homeFacilityId) ?? null,
    readsOnly: readsOnly(user.role),
  }));
}

export interface RoleGroup {
  role: Role;
  people: PersonRow[];
  /** True when the role may change nothing at all, whoever holds it. */
  readsOnly: boolean;
}

/**
 * Everybody, grouped under every role — including the roles nobody holds.
 *
 * A role with no people is an answer and not a gap: it means the organisation
 * has nobody in that seat today, which is a thing an evaluator should be able
 * to see. Dropping the empty groups would make "no auditor is employed" and
 * "this application has no auditor role" look identical on the screen, and only
 * one of those is true.
 *
 * In `ROLES` order, so the columns of the role table and the sections of the
 * people list are in the same order without either of them saying so twice.
 */
export function peopleByRole(data: DemoData): RoleGroup[] {
  const people = peopleList(data);

  return ROLES.map((role) => ({
    role,
    people: people.filter((person) => person.user.role === role),
    readsOnly: readsOnly(role),
  }));
}
