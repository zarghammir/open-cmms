import { DEFAULT_ROLE, isRole, type Role } from "@/domain/constants/roles";

/**
 * Phase 1 has no sign-in. The demo role lives in a cookie so the server
 * renders the right shell on the first paint: no flash of the wrong role, no
 * hydration mismatch. Phase 2 replaces the cookie with the signed-in user and
 * nothing else has to change.
 */
export const DEMO_ROLE_COOKIE = "wa_demo_role";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function roleFromCookieValue(value: string | undefined): Role {
  return isRole(value) ? value : DEFAULT_ROLE;
}

/** Cookie string for `document.cookie`. Used by the role switcher. */
export function roleCookieAssignment(role: Role): string {
  return `${DEMO_ROLE_COOKIE}=${role}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
