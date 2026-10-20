import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { currentUserIdForRole } from "@/data/seed/people";
import { isBelowMinimum } from "@/domain/constants/part";
import { can, ROLES, type Role } from "@/domain/constants/roles";
import { isOpenStatus, isTerminal } from "@/domain/constants/work-order-status";

/**
 * The recording can be walked wherever the role switcher lands.
 *
 * WA-87 points the coordinator and the technician at Sudbury, because
 * the switcher handed the walkthrough Raman at Moncton, whose store holds
 * nothing issuable — measured by QA: Moncton 0, Sudbury 3,
 * Kamloops 6, Regina 7, and still 0 / 3 / 6 / 7 on this branch. Moving the
 * mapping is only half of it. The other half is that the site it now points at
 * can carry the step the recording performs, and that is a fact about data
 * which drifts under every change to the seed.
 *
 * **Every role that may issue, not the one that failed.** The measured defect
 * was on the coordinator; the ticket named the technician. A guard written to
 * either one alone would leave the other free to land at a site with an empty
 * store, which is the same defect with a different name on it — so the list
 * comes from `can(role, "inventory.issue")` rather than from this file.
 *
 * Every condition is read through the predicate the application itself uses —
 * `isOpenStatus`, `isTerminal`, `isBelowMinimum` — because a test that
 * re-implements the rule it checks agrees with itself and with nothing else.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const seed = buildSeed(TODAY);

/** The roles a person can switch into that may take stock out of a store. */
const ISSUING_ROLES = ROLES.filter((role) => can(role, "inventory.issue"));

function whoAndWhere(role: Role) {
  const user = seed.users.find((one) => one.id === currentUserIdForRole(role));
  const site = seed.facilities.find((one) => one.id === user?.homeFacilityId);
  return { user, site };
}

describe("the walkthrough, wherever the role switcher lands", () => {
  it("has roles that may issue, and a real person behind each", () => {
    /*
     * The floor under everything below. Each lookup can answer nothing, and a
     * run where `ISSUING_ROLES` came back empty — or where every user lookup
     * missed — would find no site with an empty store and report perfect
     * agreement.
     */
    expect(ISSUING_ROLES.length).toBeGreaterThanOrEqual(2);
    expect(ISSUING_ROLES).toContain("technician");
    expect(ISSUING_ROLES).toContain("maintenanceCoordinator");

    const missing = ISSUING_ROLES.filter((role) => {
      const { user, site } = whoAndWhere(role);
      return !user || !site;
    });
    expect(
      missing,
      "the switcher names someone the seed does not hold",
    ).toEqual([]);
  });

  it("lands the recording's two roles at Sudbury", () => {
    // The ticket's own requirement, kept separate from the general rule above
    // so that a future move of either mapping is a deliberate edit here.
    expect(whoAndWhere("technician").site!.code).toBe("SUD");
    expect(whoAndWhere("maintenanceCoordinator").site!.code).toBe("SUD");
  });

  it("can issue a part and cross the minimum in one step, for every issuing role", () => {
    /*
     * The step the recording performs, stated as arithmetic rather than as a
     * hope, and filtered exactly as the dialog filters:
     * `parts.list(order.facilityId)` then `quantityOnHand > 0`, because a part
     * with none on hand cannot be issued and offering it would be offering a
     * refusal.
     *
     * Crossing needs a part that is **not already below** its minimum — a
     * shelf that starts low demonstrates nothing, the notice is there before
     * anybody touches it — and a smallest crossing quantity a person can
     * plausibly type in one go. Ten is a judgement and is written down as one:
     * the point of the step is the notice appearing, and a technician typing
     * forty filters to produce it is performing a test, not a job.
     */
    const stuck: string[] = [];

    for (const role of ISSUING_ROLES) {
      const { site } = whoAndWhere(role);
      const offered = seed.parts.filter(
        (part) => part.facilityId === site!.id && part.quantityOnHand > 0,
      );
      const crossings = offered
        .filter((part) => !isBelowMinimum(part))
        .map((part) => ({
          part,
          needed: part.quantityOnHand - part.reorderPoint + 1,
        }))
        .filter(
          ({ part, needed }) => needed <= part.quantityOnHand && needed <= 10,
        );

      if (crossings.length === 0) {
        stuck.push(
          `${role} at ${site!.code}: ${offered.length} issuable, none crossable in one issue`,
        );
        continue;
      }

      // The arithmetic is the application's, not this file's: the quantity
      // named really does read as below the minimum afterwards, and one less
      // does not.
      const { part, needed } = crossings[0]!;
      expect(
        isBelowMinimum(part, part.quantityOnHand - needed),
        `${role}: ${part.partNumber}`,
      ).toBe(true);
      expect(
        isBelowMinimum(part, part.quantityOnHand - needed + 1),
        `${role}: ${part.partNumber}`,
      ).toBe(false);
    }

    expect(stuck).toEqual([]);
  });

  it("gives every issuing role an open order at its own site to issue against", () => {
    /*
     * "Open" is the application's word — `OPEN_WORK_ORDER_STATUSES`, every
     * status that still wants someone's attention, which includes
     * `waitingForParts`. Taken from there rather than written out here, so
     * this cannot disagree with the queue the person is looking at.
     */
    const stuck: string[] = [];

    for (const role of ISSUING_ROLES) {
      const { site } = whoAndWhere(role);
      const here = seed.workOrders.filter(
        (order) => order.facilityId === site!.id && isOpenStatus(order.status),
      );

      if (here.length === 0) {
        stuck.push(`${role} at ${site!.code}: no open order`);
        continue;
      }

      // The control the dialog itself applies: it is drawn on any order that
      // is not terminal. An open order that were somehow terminal would
      // satisfy the assertion above and still show the person no button.
      for (const order of here) {
        expect(isTerminal(order.status), `${order.number}`).toBe(false);
      }
    }

    expect(stuck).toEqual([]);
  });

  it("puts one of those orders in the technician's own queue", () => {
    /*
     * The technician is the one role that starts from a personal list rather
     * than from the site's register, so for them the order has to be assigned
     * as well as present. The coordinator opens the site's work; the
     * technician opens theirs.
     */
    const { user, site } = whoAndWhere("technician");
    const mine = new Set(
      seed.workOrderAssignments
        .filter((assignment) => assignment.userId === user!.id)
        .map((assignment) => assignment.workOrderId),
    );

    const here = seed.workOrders.filter(
      (order) =>
        order.facilityId === site!.id &&
        mine.has(order.id) &&
        isOpenStatus(order.status),
    );

    expect(
      here.map((order) => `${order.number}:${order.status}`),
      "the walkthrough technician has no open order at their own site",
    ).not.toEqual([]);
  });
});
