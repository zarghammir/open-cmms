import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "./status-gate.test";

/**
 * No error's words end up in a record.
 *
 * Every piece of stored text in this application is a **catalogue key and its
 * arguments**, never a built sentence — AGENTS.md says so for the audit trail,
 * and WA-18's notifications and email log follow it for a different reason: a
 * sentence stored in August is still English in the French demo in October.
 *
 * That rule happens to close a whole family of defect that has bitten a
 * neighbouring project. There, an error caught during a job was stored on a
 * record and later served from a screen, so a connection failure put an
 * internal hostname in front of anybody who could read that screen. **The fix
 * for their log would not have touched it**, because the sink was different
 * and the string was the same.
 *
 * WorkAxis is clean today, and the sweep that found that said why: the two
 * places a platform error exists — the storage adapter and the camera —
 * collapse it to an enum before anything can store it. `run()` rejects and the
 * screen shows `states.saving.failedTitle`; `cameraStateForError` reads a
 * message, decides between three states, and throws the words away.
 *
 * **What is true today is not a guard.** `summaryParams` and `params` are
 * `Record<string, string | number>`, and that `string` is the only door. Every
 * value through it comes from a record — until the first time somebody wants a
 * more helpful error message, which is a reasonable thing to want and is
 * exactly how the other project's defect arrived. So this reads the source,
 * the way `status-gate.test.ts` and `data-boundary.test.ts` do, because a type
 * cannot say where a string came from.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = "src";

/**
 * The keys whose object literals end up in a stored record.
 *
 * `params` is a notification's and an email log line's; `summaryParams` is a
 * trail entry's. Both are persisted and both are rendered.
 */
const STORED_ARGUMENTS = ["params", "summaryParams"];

/**
 * An expression that carries an error's own words, inside a stored argument.
 *
 * Two rules, and the difference between them is what stops it crying wolf.
 *
 * `.message` and `.stack` are matched on **any** identifier. Both have
 * legitimate uses elsewhere — a Zod issue has a message, a toast takes one —
 * but this pattern is only ever run against the inside of a `params` or
 * `summaryParams` literal, and a value there comes from a record. A `.message`
 * in one of those is an error's, whatever the variable is called, and naming
 * the variable `failure` or `cause` should not be a way around it.
 *
 * `String(…)` and `${…}` are matched only on an **error-shaped name**, because
 * those two do have honest uses: `String(order.number)` is a coercion nobody
 * should be warned about. An interpolation building a sentence is a different
 * defect — this project's rule is a key and its arguments, never a built
 * sentence — and it is the audit-key tests that answer that one.
 *
 * The word boundary sits inside each alternative rather than in front of all
 * of them. Written as `\b(?: … )` the pattern could never match an
 * interpolation, because the character before a `$` is a backtick and there is
 * no word boundary between two non-word characters. The sample `\`${err}\``
 * in the control below is what found that — a positive control doing its job
 * before the detector had ever been asked a real question, and the second
 * thing it found was that `failure.stack` fell outside a rule I had written
 * too narrowly.
 *
 * **The third came from the deletion control, and it was the one that
 * mattered.** Planting `detail: (error as Error).message` into a real
 * notification's `params` did not redden anything: the property was reached
 * through a cast, so the character before the dot was `)` and not a word
 * character. That is not an exotic spelling — `catch (error)` gives `unknown`
 * in this codebase, so a cast is the *idiomatic* way to reach the message, and
 * the detector was blind to the most likely form of the defect it exists for.
 * It matches a closing parenthesis as well as an identifier now.
 *
 * **What it does not see, said plainly so nobody reads it as more than it
 * is.** The detector is lexical, and its window is one object literal. It
 * reads the characters between the braces of a `params` or `summaryParams`
 * literal and nothing else, so any indirection is outside it: a destructured
 * `const { message } = error` two lines above, an intermediate named `detail`
 * assigned earlier in the function, a helper that returns the words and is
 * called in the literal. All three store exactly the same string, and this
 * test stays green on all three.
 *
 * That is not a gap to be closed by a longer pattern — following a value to
 * where it came from is type-checking, and a regular expression that tried
 * would either need the whole program or cry wolf. What it catches is the
 * direct spellings, which are what a person writes first when they want a more
 * helpful message, and which is how the neighbouring project's defect actually
 * arrived. It is a floor under the rule, not a proof of it; the review
 * question "where did this string come from" is still the review's.
 */
const ERROR_TEXT =
  /(?:[\w)]\s*\.(?:message|stack)\b|\bString\(\s*\w*(?:[eE]rr|[fF]ail|[cC]ause)\w*\s*\)|\$\{\s*\w*(?:[eE]rr|[fF]ail|[cC]ause)\w*[\w.]*\s*\})/;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * The text of every object literal assigned to one of the stored-argument
 * keys, found by matching braces rather than by a pattern.
 *
 * A regular expression cannot do this: an object literal contains other object
 * literals, and `/params:\s*\{[^}]*\}/` stops at the first inner brace and
 * reads none of what follows. Counting depth is fifteen lines and is right.
 */
function storedArgumentLiterals(
  source: string,
): { key: string; line: number; text: string }[] {
  const found: { key: string; line: number; text: string }[] = [];

  for (const key of STORED_ARGUMENTS) {
    const opener = new RegExp(`\\b${key}\\s*:\\s*\\{`, "g");
    let match: RegExpExecArray | null;

    while ((match = opener.exec(source)) !== null) {
      let depth = 0;
      let index = match.index + match[0].length - 1;

      for (; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        else if (source[index] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }

      found.push({
        key,
        line: source.slice(0, match.index).split("\n").length,
        text: source.slice(match.index, index + 1),
      });
    }
  }

  return found;
}

describe("error text in stored arguments", () => {
  const sources = filesUnder(path.join(ROOT, SCANNED)).map((file) => ({
    file: path.relative(ROOT, file),
    source: withoutComments(readFileSync(file, "utf8")),
  }));

  it("finds no error's words in anything that gets stored", () => {
    const breaches: string[] = [];
    let literals = 0;

    for (const { file, source } of sources) {
      for (const literal of storedArgumentLiterals(source)) {
        literals += 1;
        const carried = ERROR_TEXT.exec(literal.text);
        if (carried) {
          breaches.push(
            `${file}:${literal.line} — ${literal.key} carries ${carried[0]}`,
          );
        }
      }
    }

    expect(breaches.join("\n")).toBe("");

    /*
     * The floor, and without it this is a test that passes on an empty list.
     * A `filesUnder` that returned nothing, a brace matcher that found no
     * literals, or a rename of `summaryParams` would all leave the assertion
     * above green while reading nothing at all.
     */
    expect(sources.length, "source files scanned").toBeGreaterThan(100);
    expect(literals, "stored-argument literals found").toBeGreaterThan(20);
  });

  it("would catch the breach it is written for", () => {
    /*
     * The detector, against the thing it exists to find and against the three
     * ways an error is legitimately handled in this codebase. The positive
     * matters most: a pattern that matched nothing would satisfy every
     * assertion in the test above.
     */
    const caught = [
      `summaryParams: { reason: error.message }`,
      `params: { detail: String(error) }`,
      `summaryParams: { number, note: \`\${err}\` }`,
      `params: { where: failure.stack }`,
      // The spelling the deletion control planted, and the one the first
      // version of this pattern missed: `catch (error)` is `unknown`, so a
      // cast is how anybody reaches the message.
      `params: { detail: (error as Error).message }`,
    ];
    for (const sample of caught) {
      const [literal] = storedArgumentLiterals(sample);
      expect(literal, `no literal found in: ${sample}`).toBeDefined();
      expect(ERROR_TEXT.test(literal!.text), `missed: ${sample}`).toBe(true);
    }

    const allowed = [
      // Classifying an error is how both platform boundaries handle one, and
      // the words are thrown away rather than stored. Outside a literal, so
      // the detector never sees it.
      `const state = error.message.includes("denied") ? "denied" : "failed";`,
      // A record's own values, which is what every argument is today.
      `summaryParams: { number: order.number, status: order.status }`,
      `params: { partNumber: part.partNumber, onHand: part.quantityOnHand }`,
      // An honest coercion of a record's own value, which is why `String(…)`
      // is matched on an error-shaped name rather than on anything.
      `params: { count: String(order.taskCount) }`,
    ];
    for (const sample of allowed) {
      const literals = storedArgumentLiterals(sample);
      const fired = literals.some((literal) => ERROR_TEXT.test(literal.text));
      expect(fired, `fired on correct code: ${sample}`).toBe(false);
    }

    expect(caught.length + allowed.length, "samples checked").toBe(9);
  });

  it("watches the one free string that is stored and shown", () => {
    /*
     * `ImportBatch.fileName` is the only user-supplied free string in the
     * records that a screen renders — the spreadsheet's own name, shown when
     * offering to undo an import. It carries no error and a browser hands over
     * a base name rather than a path, so it is not a defect; it is the single
     * door of that shape, and a second one should be a decision somebody makes
     * rather than a field that appears.
     *
     * So this is a change detector, not a prohibition: add a free string to
     * this record and the test names it and asks you to think.
     */
    const source = readFileSync(
      path.join(ROOT, "src/domain/types/import.ts"),
      "utf8",
    );
    const body = /export interface ImportBatch[^{]*\{([\s\S]*?)\n\}/.exec(
      withoutComments(source),
    );
    expect(
      body,
      "ImportBatch is not where this test thinks it is",
    ).toBeTruthy();

    const freeStrings = [
      ...body![1]!.matchAll(/^\s*(\w+)\s*:\s*string;/gm),
    ].map((match) => match[1]);
    expect(
      freeStrings,
      "a free string was added to a record that is rendered; is it always safe to show?",
    ).toEqual(["fileName"]);
  });
});
