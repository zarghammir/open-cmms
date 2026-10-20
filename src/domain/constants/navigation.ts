import {
  BellRing,
  Boxes,
  BuildingComplex,
  CalendarSync,
  ChartColumn,
  ClipboardCheck,
  CloudUpload,
  Cog,
  FileText,
  Gauge,
  ListTodo,
  SlidersHorizontal,
  type LucideIcon,
  Users,
  Wrench,
} from "lucide-react";
import { FIELD_ROLES, type Role } from "./roles";

/**
 * The module list. `key` is also the message key
 * (`modules.<key>.title`), so a label can never disagree with the route it
 * belongs to, and adding a module without translating it is a type error.
 */
export type ModuleKey =
  | "dashboard"
  | "myWork"
  | "facilities"
  | "assets"
  | "workOrders"
  | "preventiveMaintenance"
  | "inspections"
  | "inventory"
  | "documents"
  | "reports"
  | "users"
  | "settings"
  | "myNotifications"
  | "waitingToSend";

export interface AppModule {
  key: ModuleKey;
  href: string;
  icon: LucideIcon;
  /** Roles that may open the module at all. */
  roles: readonly Role[];
  /**
   * Reachable, but not listed in the navigation.
   *
   * A screen that is reached from somewhere specific — the offline banner, a
   * scanned label — rather than from the rail. It is registered here anyway so
   * that one list still answers "may this role open this", which is what keeps
   * `ModuleScreen` the single gate: a screen with no entry would be a screen
   * with no gate, and that is the shape of every guard that is correct at its
   * own layer while a neighbour lets the excluded thing back in.
   *
   * The navigation is the eleven the specification sets plus the field home;
   * adding a twelfth name to the rail would be answering a question nobody
   * asked.
   */
  hidden?: boolean;
}

const ALL_ROLES: readonly Role[] = [
  "administrator",
  "facilityManager",
  "maintenanceCoordinator",
  "technician",
  "inspector",
  "auditor",
];

const DESK_ROLES: readonly Role[] = [
  "administrator",
  "facilityManager",
  "maintenanceCoordinator",
  "auditor",
];

/**
 * Order is fixed by the specification: Dashboard, Facilities, Assets, Work
 * orders, Preventive maintenance, Inspections, Inventory, Documents, Reports,
 * Users and roles, Settings. "My work today" is the field home and sits first
 * for the roles that have it.
 */
export const MODULES: readonly AppModule[] = [
  { key: "myWork", href: "/my-work", icon: ListTodo, roles: FIELD_ROLES },
  { key: "dashboard", href: "/dashboard", icon: Gauge, roles: DESK_ROLES },
  {
    key: "facilities",
    href: "/facilities",
    icon: BuildingComplex,
    roles: DESK_ROLES,
  },
  { key: "assets", href: "/assets", icon: Cog, roles: ALL_ROLES },
  { key: "workOrders", href: "/work-orders", icon: Wrench, roles: ALL_ROLES },
  {
    key: "preventiveMaintenance",
    href: "/preventive-maintenance",
    icon: CalendarSync,
    roles: DESK_ROLES,
  },
  {
    key: "inspections",
    href: "/inspections",
    icon: ClipboardCheck,
    roles: [
      "administrator",
      "facilityManager",
      "maintenanceCoordinator",
      "inspector",
      "auditor",
    ],
  },
  {
    key: "inventory",
    href: "/inventory",
    icon: Boxes,
    roles: [
      "administrator",
      "facilityManager",
      "maintenanceCoordinator",
      "technician",
      "auditor",
    ],
  },
  { key: "documents", href: "/documents", icon: FileText, roles: ALL_ROLES },
  { key: "reports", href: "/reports", icon: ChartColumn, roles: DESK_ROLES },
  {
    key: "users",
    href: "/users",
    icon: Users,
    roles: ["administrator"],
  },
  {
    key: "settings",
    href: "/settings",
    icon: SlidersHorizontal,
    roles: ["administrator", "facilityManager"],
  },
  {
    /*
     * Every role, because what a person wants to hear about is theirs.
     *
     * The same argument as `waitingToSend` below, and it arrived the same way:
     * this screen sat on Settings, which two roles can open, so a technician —
     * the person "a job has landed on you" is written for — could not choose
     * what they hear about, and an auditor could not see the switches they are
     * meant to see disabled. Four of the six roles were locked out of their own
     * preferences.
     *
     * Hidden, so the rail keeps the eleven the specification sets. It is
     * registered here anyway because that is what keeps `ModuleScreen` the
     * single gate: a screen with no entry would be a screen with no role check.
     */
    key: "myNotifications",
    href: "/my-notifications",
    icon: BellRing,
    roles: ALL_ROLES,
    hidden: true,
  },
  {
    // Every role, because the queue belongs to the device rather than to a
    // person: whoever is holding the tablet has to be able to see what it has
    // not sent yet. Settings holds the same information for the two roles that
    // can open Settings, and a technician is exactly the person who cannot.
    key: "waitingToSend",
    href: "/waiting-to-send",
    icon: CloudUpload,
    roles: ALL_ROLES,
    hidden: true,
  },
];

/** What the navigation shows: what the role may open, minus what is not listed. */
export function modulesForRole(role: Role): readonly AppModule[] {
  return MODULES.filter(
    (module) => !module.hidden && module.roles.includes(role),
  );
}

export function canOpenModule(role: Role, key: ModuleKey): boolean {
  const found = MODULES.find((candidate) => candidate.key === key);
  return found ? found.roles.includes(role) : false;
}

export function moduleByKey(key: ModuleKey): AppModule {
  const found = MODULES.find((candidate) => candidate.key === key);
  if (!found) {
    throw new Error(`Unknown module: ${key}`);
  }
  return found;
}

/** Where a role lands when it opens the application. */
export function homeHrefForRole(role: Role): string {
  return FIELD_ROLES.includes(role) ? "/my-work" : "/dashboard";
}

/**
 * Matches a locale-stripped pathname to a module, longest href first so that a
 * future nested route (`/assets/AST-1`) still resolves to Assets.
 */
export function moduleForPathname(pathname: string): AppModule | undefined {
  return [...MODULES]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (module) =>
        pathname === module.href || pathname.startsWith(`${module.href}/`),
    );
}
