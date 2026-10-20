import { cookies } from "next/headers";
import type { Role } from "@/domain/constants/roles";
import { DEMO_ROLE_COOKIE, roleFromCookieValue } from "./demo-session";

/** The demo role for this request. Falls back to the default role. */
export async function getDemoRole(): Promise<Role> {
  const store = await cookies();
  return roleFromCookieValue(store.get(DEMO_ROLE_COOKIE)?.value);
}

/**
 * Whether the desk sidebar starts expanded. shadcn's sidebar writes this
 * cookie itself; reading it here keeps the server and client markup identical.
 */
export async function getSidebarDefaultOpen(): Promise<boolean> {
  const store = await cookies();
  const value = store.get("sidebar_state")?.value;
  return value === undefined ? true : value === "true";
}
