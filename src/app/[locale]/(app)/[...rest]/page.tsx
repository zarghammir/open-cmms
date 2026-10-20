import { notFound } from "next/navigation";

/**
 * Any address inside a locale that matches no module. Sending it through
 * `notFound()` renders the not-found screen inside the shell, in the right
 * language, with a 404 status — rather than the framework's default page.
 */
export default function UnknownRoutePage(): never {
  notFound();
}
