import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale routing. In Next.js 16 this file convention is called `proxy`; it was
 * named `middleware` up to Next.js 15.
 */
export default createMiddleware(routing);

export const config = {
  // Run on everything except Next internals, API routes and files with an
  // extension (images, fonts, robots.txt, ...).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
