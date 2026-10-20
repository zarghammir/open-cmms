import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  ROLES,
  can,
  capabilitiesOf,
  isReadOnly,
  isRole,
  viewForRole,
} from "./roles";

describe("roles", () => {
  it("lists the six roles from the specification", () => {
    expect([...ROLES]).toEqual([
      "administrator",
      "facilityManager",
      "maintenanceCoordinator",
      "technician",
      "inspector",
      "auditor",
    ]);
  });

  it("sends technicians and inspectors to the field view and everyone else to the desk view", () => {
    expect(viewForRole("technician")).toBe("field");
    expect(viewForRole("inspector")).toBe("field");
    expect(viewForRole("administrator")).toBe("desk");
    expect(viewForRole("facilityManager")).toBe("desk");
    expect(viewForRole("maintenanceCoordinator")).toBe("desk");
    expect(viewForRole("auditor")).toBe("desk");
  });

  it("rejects values that are not roles", () => {
    expect(isRole("administrator")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it("gives the administrator every capability", () => {
    for (const capability of CAPABILITIES) {
      expect(can("administrator", capability)).toBe(true);
    }
  });

  it("gives the auditor no capability at all", () => {
    for (const capability of CAPABILITIES) {
      expect(can("auditor", capability)).toBe(false);
    }
    expect(isReadOnly("auditor")).toBe(true);
  });

  it("keeps every other role out of read-only", () => {
    for (const role of ROLES) {
      if (role === "auditor") continue;
      expect(isReadOnly(role)).toBe(false);
    }
  });

  it("withholds administration from roles that are not administrators", () => {
    expect(can("facilityManager", "users.manage")).toBe(false);
    expect(can("maintenanceCoordinator", "users.manage")).toBe(false);
    expect(can("maintenanceCoordinator", "settings.manage")).toBe(false);
    expect(can("technician", "settings.manage")).toBe(false);
    expect(can("inspector", "users.manage")).toBe(false);
  });

  it("names who may attach a document, role by role", () => {
    /*
     * The grant, measured rather than left as a line in a file.
     *
     * The RFP's own scenario is the person at the machine filing what they
     * photographed, so the technician and the inspector hold this even though
     * they hold little else — and if a later change quietly narrows it to the
     * desk roles, this names which role lost it rather than reporting that a
     * count changed.
     */
    expect(can("administrator", "document.attach")).toBe(true);
    expect(can("facilityManager", "document.attach")).toBe(true);
    expect(can("maintenanceCoordinator", "document.attach")).toBe(true);
    expect(can("technician", "document.attach")).toBe(true);
    expect(can("inspector", "document.attach")).toBe(true);
    // The auditor reads. An auditor who could attach would not be one.
    expect(can("auditor", "document.attach")).toBe(false);
  });

  it("lets technicians finish work but not re-plan it", () => {
    expect(can("technician", "workOrder.complete")).toBe(true);
    expect(can("technician", "inventory.issue")).toBe(true);
    expect(can("technician", "plan.edit")).toBe(false);
    expect(can("technician", "workOrder.assign")).toBe(false);
  });

  it("lets the roles that answer for the schedule call work off, and nobody else", () => {
    // Cancelling is the one act on an order with no way back: the status map
    // has no transition out of Cancelled. It is a decision about whether work
    // should happen at all, which is not the same question as who does it.
    expect(can("administrator", "workOrder.cancel")).toBe(true);
    expect(can("facilityManager", "workOrder.cancel")).toBe(true);
    expect(can("maintenanceCoordinator", "workOrder.cancel")).toBe(true);
    expect(can("technician", "workOrder.cancel")).toBe(false);
    expect(can("inspector", "workOrder.cancel")).toBe(false);
    expect(can("auditor", "workOrder.cancel")).toBe(false);
  });

  it("keeps handing work out and calling it off as two separate capabilities", () => {
    /*
     * The control, and the reason this capability exists at all. Cancel used to
     * be planned under `workOrder.assign`; if one were declared an alias of the
     * other every assertion above would still pass while the distinction had
     * been lost — and a technician, who may finish work, would be able to
     * decide it should never have been raised.
     */
    expect(CAPABILITIES).toContain("workOrder.assign");
    expect(CAPABILITIES).toContain("workOrder.cancel");
    expect(can("technician", "workOrder.complete")).toBe(true);
    expect(can("technician", "workOrder.cancel")).toBe(false);
  });

  it("lets the roles that count stock adjust it, and nobody else", () => {
    // Verification overrides the recorded count with what is on the shelf, so
    // it is a separate capability from issuing against a job.
    expect(can("technician", "inventory.adjust")).toBe(true);
    expect(can("maintenanceCoordinator", "inventory.adjust")).toBe(true);
    expect(can("administrator", "inventory.adjust")).toBe(true);
    expect(can("facilityManager", "inventory.adjust")).toBe(true);
    expect(can("inspector", "inventory.adjust")).toBe(false);
    expect(can("auditor", "inventory.adjust")).toBe(false);
  });

  it("keeps issuing and adjusting as two separate capabilities", () => {
    // The control: if one had been declared an alias of the other, every
    // assertion above would still pass while the distinction had been lost.
    expect(CAPABILITIES).toContain("inventory.issue");
    expect(CAPABILITIES).toContain("inventory.adjust");
    expect(can("inspector", "inventory.issue")).toBe(false);
    expect(can("inspector", "inventory.adjust")).toBe(false);
  });

  it("declares no capability twice for a role", () => {
    for (const role of ROLES) {
      const granted = capabilitiesOf(role);
      expect(new Set(granted).size).toBe(granted.length);
    }
  });
});
