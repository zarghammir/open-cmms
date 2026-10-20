/**
 * The port the browser suite serves on.
 *
 * One definition, imported by both `playwright.config.ts` and the guard that
 * frees the port before a run. Two copies of a port number is how a guard ends
 * up faithfully clearing a port nobody is using.
 */
export const E2E_PORT = Number(process.env.WA_E2E_PORT ?? 3100);
