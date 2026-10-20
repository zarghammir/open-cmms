import type { Role } from "@/domain/constants/roles";
import type { Id, SiteCode, Trade } from "@/domain/types";

/**
 * The demo roster: ten invented people covering the six roles across the five
 * sites. No real person is named here.
 */

export interface UserSeed {
  id: Id;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  /** `.example` is reserved and can never be a real address. */
  email: string;
  role: Role;
  siteCode: SiteCode;
  trades: readonly Trade[];
  /** Days before today that this person started. */
  startedDaysAgo: number;
}

export const USER_SEEDS: readonly UserSeed[] = [
  {
    id: "usr-fortin",
    employeeNumber: "E-1001",
    firstName: "Amélie",
    lastName: "Fortin",
    email: "amelie.fortin@dominionlab.example",
    role: "administrator",
    siteCode: "KGN",
    trades: [],
    startedDaysAgo: 2840,
  },
  {
    id: "usr-okonkwo",
    employeeNumber: "E-1014",
    firstName: "Grace",
    lastName: "Okonkwo",
    email: "grace.okonkwo@dominionlab.example",
    role: "facilityManager",
    siteCode: "KGN",
    trades: [],
    startedDaysAgo: 2190,
  },
  {
    id: "usr-raman",
    employeeNumber: "E-1027",
    firstName: "Priya",
    lastName: "Raman",
    email: "priya.raman@dominionlab.example",
    role: "maintenanceCoordinator",
    siteCode: "MCT",
    trades: ["general"],
    startedDaysAgo: 1560,
  },
  {
    id: "usr-levesque",
    employeeNumber: "E-1033",
    firstName: "Daniel",
    lastName: "Lévesque",
    email: "daniel.levesque@dominionlab.example",
    role: "maintenanceCoordinator",
    siteCode: "SUD",
    trades: ["general"],
    startedDaysAgo: 1310,
  },
  {
    id: "usr-mbeki",
    employeeNumber: "E-1042",
    firstName: "Owen",
    lastName: "Mbeki",
    email: "owen.mbeki@dominionlab.example",
    role: "technician",
    siteCode: "KGN",
    trades: ["hvac", "general"],
    startedDaysAgo: 980,
  },
  {
    id: "usr-gagnon",
    employeeNumber: "E-1055",
    firstName: "Sophie",
    lastName: "Gagnon",
    email: "sophie.gagnon@dominionlab.example",
    role: "technician",
    siteCode: "SUD",
    trades: ["electrical", "controls"],
    startedDaysAgo: 1725,
  },
  {
    id: "usr-chartrand",
    employeeNumber: "E-1061",
    firstName: "Ryan",
    lastName: "Chartrand",
    email: "ryan.chartrand@dominionlab.example",
    role: "technician",
    siteCode: "MCT",
    trades: ["general", "hvac"],
    startedDaysAgo: 640,
  },
  {
    id: "usr-singh",
    employeeNumber: "E-1078",
    firstName: "Kiara",
    lastName: "Singh",
    email: "kiara.singh@dominionlab.example",
    role: "technician",
    siteCode: "KAM",
    trades: ["general", "electrical"],
    startedDaysAgo: 420,
  },
  {
    id: "usr-beaulieu",
    employeeNumber: "E-1084",
    firstName: "Élise",
    lastName: "Beaulieu",
    email: "elise.beaulieu@dominionlab.example",
    role: "inspector",
    siteCode: "REG",
    trades: ["inspection"],
    startedDaysAgo: 1190,
  },
  {
    id: "usr-ferreira",
    employeeNumber: "E-1096",
    firstName: "Tomás",
    lastName: "Ferreira",
    email: "tomas.ferreira@dominionlab.example",
    role: "auditor",
    siteCode: "KGN",
    trades: [],
    startedDaysAgo: 560,
  },
];

/**
 * Who a legacy crew code turns out to be.
 *
 * The MP2 export assigns work to codes like `TECH03` and `HVAC02`. Those are
 * crew positions, not people — the fixture's own dictionary says so — which is
 * why several codes map to the same person and why that is correct rather
 * than a shortcut.
 *
 * `contractor` is its own answer: work done by an external firm is neither
 * unassigned nor assigned to a member of staff, and flattening it into either
 * would lose what the source system recorded.
 */
export type CrewAssignment =
  { kind: "user"; userId: Id } | { kind: "contractor" };

const toUser = (userId: Id): CrewAssignment => ({ kind: "user", userId });

export const CREW_CODE_ASSIGNMENTS: Readonly<Record<string, CrewAssignment>> = {
  TECH01: toUser("usr-mbeki"),
  TECH02: toUser("usr-mbeki"),
  TECH03: toUser("usr-mbeki"),
  TECH04: toUser("usr-gagnon"),
  TECH05: toUser("usr-gagnon"),
  TECH06: toUser("usr-gagnon"),
  TECH07: toUser("usr-chartrand"),
  TECH08: toUser("usr-chartrand"),
  TECH09: toUser("usr-chartrand"),
  TECH10: toUser("usr-singh"),
  TECH11: toUser("usr-singh"),
  TECH12: toUser("usr-singh"),
  HVAC01: toUser("usr-mbeki"),
  HVAC02: toUser("usr-mbeki"),
  HVAC03: toUser("usr-chartrand"),
  HVAC04: toUser("usr-chartrand"),
  ELEC01: toUser("usr-gagnon"),
  ELEC02: toUser("usr-gagnon"),
  ELEC03: toUser("usr-singh"),
  CONT01: { kind: "contractor" },
};

/**
 * Three answers, not two.
 *
 * `undefined` means the code is not one this organisation uses — which is not
 * the same as "nobody is assigned". An importer must keep the code and leave
 * the order unassigned rather than treating an unreadable value as an empty
 * one.
 */
export function assignmentForCrewCode(
  code: string,
): CrewAssignment | undefined {
  return CREW_CODE_ASSIGNMENTS[code.trim().toUpperCase()];
}

/**
 * Who the demo is acting as.
 *
 * Phase 1 has no sign-in: the role comes from the `wa_demo_role` cookie, and
 * this is the seeded person that role belongs to, so an audit entry names
 * somebody real instead of "system". Phase 2 replaces both with the signed-in
 * user and the audit trail keeps its shape.
 */
const ROLE_TO_USER: Readonly<Record<Role, Id>> = {
  administrator: "usr-fortin",
  facilityManager: "usr-okonkwo",
  /*
   * Sudbury, not Moncton, and this is one line rather than new people
   * because **both already exist**: Lévesque coordinates there and Gagnon is a
   * technician there. The walkthrough could not issue a part because the
   * switcher handed it Raman at Moncton, whose store holds nothing — measured
   * by QA: Moncton 0 issueable parts, Sudbury 3, Kamloops 6,
   * Regina 7.
   *
   * Raman does not move. He is still Moncton's coordinator in the records, and
   * WA-90's map still draws Moncton. What changed is which of two real people
   * the role switcher hands you, and the French vignette now lands at a Quebec
   * site, where French is actually spoken.
   */
  maintenanceCoordinator: "usr-levesque",
  technician: "usr-gagnon",
  inspector: "usr-beaulieu",
  auditor: "usr-ferreira",
};

export function currentUserIdForRole(role: Role): Id {
  return ROLE_TO_USER[role];
}
