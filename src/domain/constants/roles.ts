/**
 * Roles and capabilities.
 *
 * Phase 1 has no sign-in: the role is a demo session setting that the reviewer
 * switches from the session menu. It is still the single gate for navigation
 * and actions, so that Phase 2 can replace the source of the role (real
 * sign-in) without touching any screen.
 */

export const ROLES = [
  "administrator",
  "facilityManager",
  "maintenanceCoordinator",
  "technician",
  "inspector",
  "auditor",
] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "administrator";

/** The two experiences. The role decides which one is home. */
export const VIEWS = ["desk", "field"] as const;
export type AppView = (typeof VIEWS)[number];

/** Roles whose home is the phone-first field view. */
export const FIELD_ROLES: readonly Role[] = ["technician", "inspector"];

export function viewForRole(role: Role): AppView {
  return FIELD_ROLES.includes(role) ? "field" : "desk";
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/**
 * Capabilities are the write actions in the product. Read access is decided by
 * module visibility (see navigation.ts); a capability is only ever needed to
 * change something, which is why the auditor holds none of them.
 *
 * `workOrder.cancel` is separate from `workOrder.assign` for the same reason.
 * Cancelling is a decision about whether work should happen at all, and it is
 * the one act on an order that cannot be undone — the status map has no way
 * back out of Cancelled. A technician finishes work and logs time; deciding it
 * should never have been raised belongs to whoever answers for the schedule.
 * Folding it into assignment would have made "may hand work out" and "may call
 * work off" the same permission, which is the kind of thing an evaluator asks
 * about.
 *
 * `inventory.issue` and `inventory.adjust` are deliberately two capabilities.
 * Issuing takes a known quantity out against a job; adjusting overrides the
 * recorded count with what was found on the shelf during a verification, which
 * can move stock in either direction and answers to nothing but the count. The
 * inspector holds neither: an inspector records findings, not stock.
 */
export const CAPABILITIES = [
  "workOrder.create",
  "workOrder.assign",
  "workOrder.complete",
  "workOrder.cancel",
  "asset.edit",
  "document.attach",
  "inspection.complete",
  "inventory.issue",
  "inventory.adjust",
  "plan.edit",
  "users.manage",
  "settings.manage",
  "demo.reset",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  administrator: CAPABILITIES,
  facilityManager: [
    "workOrder.create",
    "workOrder.assign",
    "workOrder.complete",
    "workOrder.cancel",
    "asset.edit",
    "document.attach",
    "inspection.complete",
    "inventory.issue",
    "inventory.adjust",
    "plan.edit",
    "settings.manage",
    "demo.reset",
  ],
  maintenanceCoordinator: [
    "workOrder.create",
    "workOrder.assign",
    "workOrder.complete",
    "workOrder.cancel",
    "asset.edit",
    "document.attach",
    "inventory.issue",
    "inventory.adjust",
    "plan.edit",
  ],
  technician: [
    "workOrder.create",
    "workOrder.complete",
    "document.attach",
    "inventory.issue",
    "inventory.adjust",
  ],
  /*
   * `document.attach` reaches the technician and the inspector on purpose.
   * The RFP's own scenario is somebody at the machine filing what they took a
   * photograph of, and a system where only a coordinator can attach paperwork
   * is one where the paperwork arrives a day late or not at all. The auditor
   * still holds nothing: `isReadOnly` is that list being empty, and an auditor
   * who could attach would no longer be reading.
   */
  inspector: ["workOrder.create", "document.attach", "inspection.complete"],
  auditor: [],
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/** True when a role may not change anything at all. */
export function isReadOnly(role: Role): boolean {
  return ROLE_CAPABILITIES[role].length === 0;
}

export function capabilitiesOf(role: Role): readonly Capability[] {
  return ROLE_CAPABILITIES[role];
}
