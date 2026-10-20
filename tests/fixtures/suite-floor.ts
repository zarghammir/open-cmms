import { readFileSync } from "node:fs";

/**
 * Whether the browser suite ran what it collected.
 *
 * A run that collects 500 tests and executes 411 exits 0 today, because
 * Playwright reports on what it ran and says nothing about what it did not.
 * On Friday a run dropped 89 tests that way and nobody could tell from the
 * output. The two numbers have to be printed beside each other, and their
 * difference has to be accounted for by name.
 *
 * **The expected difference is derived, never typed.** A count written here
 * would be wrong the first time somebody adds a screenshot spec, and the
 * failure would look like this floor working rather than like this floor being
 * stale. So the gated set is read from the specs themselves: a file that gates
 * itself on an environment variable that is unset is expected to be skipped,
 * and every other skip is a finding.
 *
 * **A parked test must name a ticket.** `test.fixme()` is a declared absence and
 * is reported amber rather than red, because red gets the reporter switched off
 * by whoever wants their green back. But amber with no ceiling makes
 * `test.fixme()` the cheapest possible way to stop a test failing, and this
 * reporter is what would make that legitimate. The ceiling is not a count — a
 * count is a number somebody raises in one character. The ceiling is that every
 * parked entry names a ticket, so parking costs a filing and the amber list is
 * a work queue with owners. A park that names none is unexplained and fails.
 *
 * What this cannot see, because the check is over counts and file paths:
 * a test that runs and asserts nothing, a spec file that was never written, and
 * a `test.skip()` written inside a single case rather than at the file's head —
 * that last one reads as an unexpected skip and fails, which is the safe
 * direction.
 */

/** A gate a spec puts on itself, e.g. `test.skip(!process.env.WA_SCREENSHOTS, …)`. */
const GATE = /test\.skip\(\s*!process\.env\.([A-Z0-9_]+)/g;

/**
 * The ticket a parked test names, e.g. `test.fixme(true, "WA-92: …")`.
 *
 * Deliberately the project's own key and nothing wider. A generic
 * `[A-Z]+-\d+` would accept `UTF-8` and `ISO-8601`, and a park only has to buy
 * one exemption to be worth writing. This is the second name written down on
 * purpose in this file, for the same reason as the gate list: it is a fact
 * about the repository, so changing it is a decision that gets read in review.
 */
const TICKET = /\bWA-\d+\b/;

/** The ticket key a park declares, or null if it declares none. */
export function ticketIn(description?: string): string | null {
  return description?.match(TICKET)?.[0] ?? null;
}

/**
 * The environment gates a spec file declares.
 *
 * Read from source rather than from a list, so a spec that adds a gate is
 * covered the day it lands and a spec that drops one stops being excused.
 */
export function gatesOf(file: string, read = readFileSync): string[] {
  const source = String(read(file, "utf8"));
  return [...source.matchAll(GATE)].map((m) => m[1]);
}

/** Whether every gate on a file is satisfied, so its tests are expected to run. */
export function fileShouldRun(
  gates: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return gates.every((name) => Boolean(env[name]));
}

export interface TestRecord {
  /** Absolute path of the spec the test came from. */
  file: string;
  /** The title a person reads in the output. */
  title: string;
  /** What Playwright did with it. */
  ran: boolean;
}

/** What Playwright recorded about a `test.fixme()`: where, and what it said. */
export interface ParkedNote {
  /** `file.spec.ts:line`, from the annotation rather than from source. */
  at: string;
  /** The annotation's description, which is where the ticket has to be. */
  description?: string;
}

/** A park that paid for itself: it named a ticket. */
export interface ParkedEntry {
  title: string;
  at: string;
  ticket: string;
}

export interface FloorVerdict {
  collected: number;
  executed: number;
  skipped: number;
  /** Skips a gate accounts for. */
  gated: number;
  /**
   * Skips declared with `test.fixme()` **that name a ticket**: reported every
   * run, never silent, not a failure. One that names no ticket is not here; it
   * is in `unexplained`, because an absence nobody owns is not a declaration.
   */
  parked: ParkedEntry[];
  /** Skips nothing accounts for — the defect this exists to catch. */
  unexplained: string[];
  ok: boolean;
  line: string;
}

/**
 * The verdict, as a pure function so it can be tested without a browser.
 *
 * `collected === 0` is a failure in its own right and not a vacuous pass. A
 * filter naming a spec that does not exist collects nothing, runs nothing and
 * exits 0 — a lane lost time to exactly that — so an empty run is refused here
 * rather than being congratulated.
 */
export function floorVerdict(
  tests: readonly TestRecord[],
  gatesFor: (file: string) => readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  parkedBy: ReadonlyMap<string, ParkedNote> = new Map(),
): FloorVerdict {
  const collected = tests.length;
  const executed = tests.filter((t) => t.ran).length;
  const skipped = collected - executed;

  const unexplained: string[] = [];
  const parked: ParkedEntry[] = [];
  let gated = 0;
  for (const t of tests) {
    if (t.ran) continue;
    const note = parkedBy.get(t.title);
    if (note) {
      // A park is a declaration, and a declaration names its owner. Without
      // this branch `test.fixme()` is a way to make a failing test stop
      // failing, which is the defect this whole floor exists to refuse.
      const ticket = ticketIn(note.description);
      if (ticket) parked.push({ title: t.title, at: note.at, ticket });
      else
        unexplained.push(
          `${t.title} — parked with test.fixme() but names no ticket (${note.at})`,
        );
    } else if (fileShouldRun(gatesFor(t.file), env)) unexplained.push(t.title);
    else gated += 1;
  }

  const ok = collected > 0 && unexplained.length === 0;
  const line =
    collected === 0
      ? "suite floor: collected 0 tests — the filter matched nothing, which is not a pass"
      : `suite floor: collected ${collected}, executed ${executed}, skipped ${skipped} (${gated} gated, ${parked.length} parked, ${unexplained.length} unexplained)`;

  return { collected, executed, skipped, gated, parked, unexplained, ok, line };
}
