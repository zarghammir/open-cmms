import { describe, expect, it } from "vitest";
import {
  assignablePeople,
  canBeAssignedWork,
  rolesNotAssignable,
} from "@/data/selectors/assignable";
import { buildSeed } from "@/data/seed";
import { isReadOnly, ROLES } from "@/domain/constants/roles";
import type { User } from "@/domain/types";

/**
 * The rule itself, read against `roles.ts` rather than against a list.
 *
 * The two screens are checked where a person sees them; this checks the thing
 * they both call, including the cases the seeded estate does not contain — an
 * inactive technician, a role added later — which a test over the demonstration
 * data alone would never reach.
 */

const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));

function personOf(overrides: Partial<User>): User {
  return {
    ...seed.users[0]!,
    id: "usr-made-up",
    ...overrides,
  };
}

describe("who can be assigned work", () => {
  it("is exactly the roles that may change something", () => {
    /*
     * Derived on both sides from `roles.ts`, so this cannot drift from it, and
     * a role added tomorrow is covered without anybody editing a list here.
     *
     * The inspector is IN, and that is the decision this file records. The
     * narrower reading — `workOrder.complete`, since an inspector completes
     * inspections rather than work orders — is defensible from the capability
     * table alone, and it turned a green browser test red:
     * `assign-order.spec.ts` hands an order from a technician to the inspector
     * and asserts it arrives on the inspector's own list. A passing test about
     * the behaviour beats an inference from the table, and the ticket named the
     * auditor alone.
     */
    const allowed = ROLES.filter((role) =>
      canBeAssignedWork(personOf({ role, active: true })),
    );
    expect(allowed).toEqual(ROLES.filter((role) => !isReadOnly(role)));

    expect(allowed).not.toContain("auditor");
    expect(allowed).toContain("inspector");
    expect(allowed).toContain("technician");
    expect(allowed.length).toBeGreaterThan(1);
  });

  it("leaves out somebody who has left, whatever their role", () => {
    // Not in the seeded estate — every seeded person is active — so it is only
    // reachable here, and it is the case a screen would show as a live choice.
    expect(
      canBeAssignedWork(personOf({ role: "technician", active: false })),
    ).toBe(false);
    expect(
      canBeAssignedWork(personOf({ role: "technician", active: true })),
    ).toBe(true);
  });

  it("names the roles it is leaving out, and only those present", () => {
    expect(rolesNotAssignable(seed.users)).toEqual(["auditor"]);

    // Only roles the list actually holds: naming a role nobody in this
    // organisation has would be explaining an absence that is not there.
    const withoutAuditors = seed.users.filter(
      (user) => user.role !== "auditor",
    );
    expect(rolesNotAssignable(withoutAuditors)).toEqual([]);
    expect(rolesNotAssignable([])).toEqual([]);
  });

  it("keeps everyone else, and the two lists add up", () => {
    /*
     * The floor and the control in one: a filter that returned nothing would
     * satisfy every "is not offered" assertion in the screen tests, and one
     * that returned everybody would satisfy this file's first case only
     * because `allowed` is derived. The counts have to add up to the estate.
     */
    const offered = assignablePeople(seed.users);
    expect(offered.length).toBeGreaterThan(3);
    expect(offered.length).toBeLessThan(seed.users.length);

    const left = seed.users.filter((user) => !offered.includes(user));
    expect(offered.length + left.length).toBe(seed.users.length);
    expect(left.map((user) => user.role)).toEqual(["auditor"]);
  });
});
