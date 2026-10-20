import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "./status-gate.test";

/**
 * Every repository context is handed the records **live**, never a snapshot.
 *
 * `createRepositories({ data, … })` and `createRepositories({ get data() … })`
 * are the same type, compile identically, and behave identically in every unit
 * test — because a unit harness re-reads the store between calls anyway. They
 * differ in exactly one situation, and it is the one a person is standing in:
 * React does not re-render inside a click handler, so a component that passes
 * `data` by value hands every repository the records as they were when it last
 * rendered. A handler that writes twice reads, on its second write, a world in
 * which its first write did not happen.
 *
 * Measured, before WA-76 fixed it: a sweep that raised one work order per
 * click instead of thirteen. The second schedule was handed the same free
 * number as the first, `applyMutation` threw `workOrders already holds id …`,
 * and the throw escaped the handler — so the person saw one order appear and
 * no error at all. The unit suite was green throughout, and could not have
 * been anything else: every harness gives a getter.
 *
 * That is why this is a source-reading check. The defect is invisible to the
 * type system (both spellings type-check), invisible to the unit suite (its
 * harnesses do not reproduce the condition), and invisible to a browser test
 * unless that test happens to write twice in one handler. What is left is the
 * text.
 *
 * What this cannot see: a context object built up in a variable and passed by
 * name, or a getter that returns a captured value rather than reading the
 * store. It reads the call site, not the data flow.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = "src";

/** The declaration itself is not a call site. */
const ALLOWED = new Set(["src/data/repositories/index.ts"]);

/** How many lines after the call opens the argument object is looked for in. */
const WINDOW = 40;

/**
 * Each `createRepositories(` in a file, with the source that follows it.
 *
 * The window is line-based rather than brace-matched on purpose: the argument
 * carries a long docblock in the one real call site, and a brace matcher that
 * had to understand comments, strings and nested objects would be a parser
 * with its own bugs guarding a one-line rule.
 */
export function contextsPassed(
  source: string,
): { line: number; live: boolean }[] {
  const lines = withoutComments(source).split("\n");

  return lines.flatMap((line, index) => {
    if (!/\bcreateRepositories\s*\(/.test(line)) return [];
    const window = lines.slice(index, index + WINDOW).join("\n");
    return [{ line: index + 1, live: /\bget\s+data\s*\(\s*\)/.test(window) }];
  });
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFilesUnder(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const files = sourceFilesUnder(path.join(ROOT, SCANNED))
  .map((file) => path.relative(ROOT, file))
  .filter((file) => !ALLOWED.has(file));

const callSites = files.flatMap((file) =>
  contextsPassed(readFileSync(path.join(ROOT, file), "utf8")).map((found) => ({
    file,
    ...found,
  })),
);

describe("a repository context reads the records live", () => {
  /**
   * The floor, and it is the whole of what makes the assertion below mean
   * anything.
   *
   * There is exactly one call site in `src/` today. If a refactor moves or
   * renames it, the sweep finds nothing, every assertion passes, and the check
   * quietly stops guarding — the shape this project has been bitten by more
   * than once. So the absence of call sites is itself a failure.
   */
  it("finds at least one call site to check", () => {
    expect(
      callSites.length,
      "No createRepositories( call site was found in src/. Either the hook was renamed — in which " +
        "case this detector needs to follow it — or this check has been passing on an empty sweep.",
    ).toBeGreaterThan(0);
  });

  it.each(
    callSites.map((site) => [`${site.file}:${site.line}`, site] as const),
  )("%s", (_name, site) => {
    expect(
      site.live,
      `${site.file}:${site.line} passes the records to createRepositories by value. ` +
        "React does not re-render inside a click handler, so every repository built here reads the " +
        "records as they were at the last render: a handler that writes twice will read, on its " +
        "second write, a world where its first write never happened. That is WA-76, measured as a " +
        "sweep raising one work order instead of thirteen. Pass `get data() { … }` instead.",
    ).toBe(true);
  });
});

describe("the detector", () => {
  it("accepts a getter", () => {
    expect(
      contextsPassed(
        [
          "createRepositories({",
          "  get data() {",
          "    return d;",
          "  },",
          "});",
        ].join("\n"),
      ),
    ).toEqual([{ line: 1, live: true }]);
  });

  it("rejects the snapshot, which is the defect", () => {
    expect(
      contextsPassed(
        ["createRepositories({", "  data,", "  commit,", "});"].join("\n"),
      ),
    ).toEqual([{ line: 1, live: false }]);
    expect(
      contextsPassed(
        ["createRepositories({", "  data: data,", "});"].join("\n"),
      ),
    ).toEqual([{ line: 1, live: false }]);
  });

  it("finds the call however it is spaced or wrapped", () => {
    expect(
      contextsPassed(
        "const r = createRepositories ({ get data() { return d; } });",
      ),
    ).toEqual([{ line: 1, live: true }]);
    // The real call site opens the object on the same line as a ternary.
    expect(
      contextsPassed(
        [
          "const r = data",
          "  ? createRepositories({",
          "      get data() {}",
          "    })",
          "  : null;",
        ].join("\n"),
      ),
    ).toEqual([{ line: 2, live: true }]);
  });

  it("does not read a commented-out call as a call site", () => {
    expect(contextsPassed("// createRepositories({ data });")).toEqual([]);
    expect(contextsPassed("/*\n * createRepositories({ data })\n */")).toEqual(
      [],
    );
  });

  it("reports every call site, not only the first", () => {
    expect(
      contextsPassed(
        [
          "createRepositories({ get data() {} });",
          ...Array.from({ length: WINDOW }, () => ""),
          "createRepositories({ data });",
        ].join("\n"),
      ),
    ).toEqual([
      { line: 1, live: true },
      { line: WINDOW + 2, live: false },
    ]);
  });
});
