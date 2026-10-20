import type { Capability, Role } from "@/domain/constants/roles";
import type { Id, IsoDate, TenantOwned } from "./common";

/**
 * A permission is a capability. There is one registry of them
 * (`domain/constants/roles.ts`) rather than a second list that could drift out
 * of step with the one the interface actually checks.
 */
export type Permission = Capability;

/** What a person is qualified to work on. Crew codes map onto these. */
export const TRADES = [
  "general",
  "hvac",
  "electrical",
  "controls",
  "inspection",
] as const;
export type Trade = (typeof TRADES)[number];

export interface User extends TenantOwned {
  id: Id;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  homeFacilityId: Id;
  trades: readonly Trade[];
  active: boolean;
  startedOn: IsoDate;
}

export function fullName(user: Pick<User, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`;
}
