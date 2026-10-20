import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Always import `Link` and `useRouter`
 * from here, never from `next/link` or `next/navigation`, so that the active
 * locale stays in the URL.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
