import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  MODULES,
  canOpenModule,
  homeHrefForRole,
  moduleByKey,
  moduleForPathname,
  modulesForRole,
  type ModuleKey,
} from "./navigation";
import { ROLES, viewForRole } from "./roles";

const SPECIFIED_ORDER: ModuleKey[] = [
  "dashboard",
  "facilities",
  "assets",
  "workOrders",
  "preventiveMaintenance",
  "inspections",
  "inventory",
  "documents",
  "reports",
  "users",
  "settings",
];

describe("navigation", () => {
  it("keeps the eleven modules in the order the specification sets", () => {
    // The field home and anything not listed in the navigation are set aside:
    // the specification names eleven modules and this is about those eleven.
    const listed = MODULES.filter((module) => !module.hidden)
      .map((module) => module.key)
      .filter((key) => key !== "myWork");
    expect(listed).toEqual(SPECIFIED_ORDER);
  });

  it("puts the field home first, before the desk modules", () => {
    expect(MODULES[0]?.key).toBe("myWork");
  });

  it("has a unique key and href for every module", () => {
    const keys = MODULES.map((module) => module.key);
    const hrefs = MODULES.map((module) => module.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("names every module in both catalogues", () => {
    const fields = [
      "title",
      "description",
      "emptyTitle",
      "emptyBody",
      "point1",
      "point2",
      "point3",
    ] as const;

    for (const entry of MODULES) {
      for (const field of fields) {
        const english = (en.modules as Record<string, Record<string, string>>)[
          entry.key
        ]?.[field];
        const french = (fr.modules as Record<string, Record<string, string>>)[
          entry.key
        ]?.[field];
        expect(english, `en ${entry.key}.${field}`).toBeTruthy();
        expect(french, `fr ${entry.key}.${field}`).toBeTruthy();
      }
    }
  });

  it("gives every role a home it is allowed to open", () => {
    for (const role of ROLES) {
      const home = homeHrefForRole(role);
      const entry = moduleForPathname(home);
      expect(entry, `home for ${role}`).toBeDefined();
      expect(canOpenModule(role, entry!.key)).toBe(true);
    }
  });

  it("routes field roles to today's work and desk roles to the dashboard", () => {
    for (const role of ROLES) {
      const expected =
        viewForRole(role) === "field" ? "/my-work" : "/dashboard";
      expect(homeHrefForRole(role)).toBe(expected);
    }
  });

  it("gives every role at least one module", () => {
    for (const role of ROLES) {
      expect(modulesForRole(role).length).toBeGreaterThan(0);
    }
  });

  it("keeps administration out of reach of the roles that may not administer", () => {
    expect(canOpenModule("auditor", "users")).toBe(false);
    expect(canOpenModule("auditor", "settings")).toBe(false);
    expect(canOpenModule("technician", "users")).toBe(false);
    expect(canOpenModule("maintenanceCoordinator", "users")).toBe(false);
    expect(canOpenModule("administrator", "users")).toBe(true);
  });

  it("hides the desk dashboard from field roles and the field home from desk roles", () => {
    expect(canOpenModule("technician", "dashboard")).toBe(false);
    expect(canOpenModule("inspector", "dashboard")).toBe(false);
    expect(canOpenModule("administrator", "myWork")).toBe(false);
    expect(canOpenModule("auditor", "myWork")).toBe(false);
  });

  it("keeps a hidden module out of both rails while leaving it reachable", () => {
    const hidden = MODULES.filter((module) => module.hidden);

    // Without this the loop below would pass against a registry with nothing
    // hidden in it, which is the state this rule was written in.
    expect(hidden.length).toBeGreaterThan(0);

    for (const entry of hidden) {
      for (const role of ROLES) {
        // Both rails — the desk sidebar and the field sheet — render exactly
        // what this returns, so this is where a hidden module would show up.
        expect(
          modulesForRole(role).some((listed) => listed.key === entry.key),
          `${entry.key} listed for ${role}`,
        ).toBe(false);

        // Not listed is not the same as not allowed. The gate still answers.
        expect(
          canOpenModule(role, entry.key),
          `${role} may open ${entry.key}`,
        ).toBe(entry.roles.includes(role));
      }
    }
  });

  it("lets every role open the queue waiting on their own device", () => {
    // The queue belongs to the device, not to a person: a technician cannot
    // open Settings, and is exactly who needs to see what has not been sent.
    for (const role of ROLES) {
      expect(canOpenModule(role, "waitingToSend"), role).toBe(true);
    }
  });

  it("resolves a nested record path back to its module", () => {
    expect(moduleForPathname("/assets")?.key).toBe("assets");
    expect(moduleForPathname("/assets/AST-0421")?.key).toBe("assets");
    expect(moduleForPathname("/work-orders/WO-2026-0148")?.key).toBe(
      "workOrders",
    );
    expect(moduleForPathname("/nowhere")).toBeUndefined();
  });

  it("throws on an unknown module key rather than returning nothing", () => {
    expect(() => moduleByKey("assets")).not.toThrow();
    expect(() => moduleByKey("nope" as ModuleKey)).toThrow();
  });
});
