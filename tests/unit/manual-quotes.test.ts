import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { ROLES } from "@/domain/constants/roles";
import { WORK_ORDER_STATUSES } from "@/domain/types/work-order";
import { locales } from "@/i18n/routing";

/**
 * Every quoted string in the manual is the product's own words.
 *
 * `docs/manual` describes fourteen screens, and its whole claim is that when it
 * puts something in quotation marks, that is what the screen says. A claim
 * without a guard is a coincidence waiting to return: the first draft carried
 * nine defects of three kinds, and two of them were found by a person reading.
 *
 * The three kinds, because they are what this exists to stop:
 *
 *   A **splice** — `"Work raised against this asset, open first,"` where the
 *   catalogue value ends in a full stop. The comma is the author's, inside the
 *   author's sentence, wearing the product's quotation marks.
 *
 *   An **added stop** — `"Your choices were saved."` where the catalogue value
 *   carries no terminal punctuation at all. The same defect with the sign
 *   reversed, and the one nobody thought to look for.
 *
 *   An **invention** — a number, a label or a sentence that is on no screen.
 *
 * **A checker's own tolerance is its blind spot.** Every normalisation a
 * comparison performs erases a class of defect, so each one this performs is
 * named below with what it lets through. A future reader learns from this
 * paragraph what the green does not cover; there is nowhere else to learn it.
 *
 * ## What it normalises, and what that makes invisible
 *
 *   **Whitespace is collapsed.** Markdown wraps a sentence across lines and the
 *   catalogue holds it on one, so a quote could never match otherwise. It
 *   follows that a quote whose *internal* spacing differs from the product's —
 *   a double space, a non-breaking space where the product has an ordinary one
 *   — passes. That matters most in French, which this does not read anyway.
 *
 *   **A quote may be a substring of a catalogue value, not only the whole of
 *   it.** The manual legitimately quotes one sentence of a two-sentence
 *   description, or the half of a sentence that sits on one side of a
 *   placeholder. It follows that a partial quote which stops mid-thought, and
 *   so misleads by where it ends rather than by what it contains, passes.
 *
 *   Note what this deliberately does **not** normalise, because the temptation
 *   is to add it and the cost is the added-stop defect: **terminal punctuation
 *   is compared exactly.** An added stop makes the quote longer than the value,
 *   so it is not a substring of it, and it fails. A checker that trimmed the
 *   final character to let partials through would be unable to see that class
 *   at all — by construction, not by accident.
 *
 *   **Case, apostrophes and quotation marks are compared exactly too.** The
 *   direction that can actually occur is an editor's smart quotes turning `'`
 *   into `’` while somebody types a quotation: the English catalogue holds
 *   fifteen values with a straight apostrophe and none with a typographic one,
 *   so a typographic one in the manual is always the author's. It fails, which
 *   is wanted. (An earlier draft of this paragraph named the opposite
 *   direction, which has no possible subject.)
 *
 *   **A placeholder breaks a value into segments, and a quote must lie inside
 *   one** — unless the placeholder has a closed set of values that lives in the
 *   catalogue, in which case every one of them is generated and the whole
 *   rendered sentence is quotable.
 *
 *   Three qualify, and the sets come from the same constants the product uses:
 *   `{role}` from `ROLES`, `{status}` from `WORK_ORDER_STATUSES`, `{language}`
 *   from `locales`. Nothing is invented; each expansion is a string the
 *   application can actually render. The other sixty-nine placeholders take
 *   values the application computes, and they stay holes. **That line is where
 *   it is because of this guard's own first draft**, which substituted a
 *   wildcard for every placeholder: `"{tag}"` became "match anything" and
 *   `"Showing 12 of 240"` passed against `"Showing {shown} of {total}"` — the
 *   invention this exists to catch, waved through by the matcher meant to catch
 *   it. A quote that needs a computed number is not quotable here, and the
 *   manual describes such a screen rather than quoting it.
 *
 *   **The tolerance and its cost, in one breath.** Expanding `{role}` is what
 *   lets the manual quote `"Auditor cannot do this. Switch role to continue."`,
 *   which is the sentence a reader actually meets; nobody ever sees `"{role}
 *   cannot do this"`. It follows that `"Technician cannot do this. Switch role
 *   to continue."` also passes, **including inside a paragraph about an
 *   auditor**. This checks that a rendered sentence is real. It does not check
 *   that it is the right one for the paragraph it sits in. The control table
 *   below measures that rather than asserting it.
 *
 *   **It reads `messages/en.json` only.** A French quote is not checked at all.
 *
 * ## What it cannot see whatever it normalises
 *
 *   A **paraphrase**. No quotation marks, nothing to compare. Most of the
 *   manual is paraphrase and none of it is covered here.
 *
 *   A **control that exists nowhere**. This reads quotation marks, not claims.
 *   The companion sweep — bolded terms against the catalogue — finds inventions
 *   and can never find a misquote, because bold marks what the author decided
 *   to call a control. The two nets are weak in opposite directions, which is
 *   why the first draft needed both.
 *
 *   **Whether a quote is attributed to the right screen.** A caption from the
 *   parts register quoted in the reports chapter is somewhere in the catalogue,
 *   so it passes. This checks provenance, not placement.
 *
 * ## The controls, one per normalisation, and what each measured
 *
 * A control that breaks a quote in any old way proves only that the test can
 * fail. The failure that matters is a sweep quietly folding away a difference
 * it claims to catch, so there is one control per normalisation above. Each was
 * planted, run, and reverted. A control that stays green is not a pass: it is
 * the name of a class this cannot see, and it belongs in the list above.
 *
 *   | Planted                                   | Measured | Plant confirmed |
 *   | ----------------------------------------- | -------- | --------------- |
 *   | Double space inside a quoted string        | green    | read back off disk, before the run |
 *   | Straight apostrophe -> typographic         | red      | by its own red |
 *   | Opening letter lower-cased                 | red      | by its own red |
 *   | A placeholder's value quoted as if literal | red      | by its own red |
 *   | A full stop the catalogue does not have    | red      | by its own red |
 *   | A comma where the catalogue ends a sentence| red      | by its own red |
 *   | The quote parser made to find nothing      | red, on the floor test | by its own red |
 *   | A directory read matching nothing          | red, on the floor test | by its own red |
 *   | A role name contradicting its paragraph    | green    | read back off disk, before the run |
 *
 * **A control that expects green must assert its plant landed. A control that
 * expects red asserts it by failing.** The asymmetry is not pedantry: a plant
 * that never applied leaves the tree untouched and the suite green, which for
 * the seven red-expecting rows is the opposite of what was expected and so
 * announces itself. For the two green-expecting rows it is indistinguishable
 * from the documented outcome, and the conclusion drawn from those two rows
 * carries the whole blind-spot section. Both were confirmed by re-reading the
 * file after writing it and checking the planted text was present — which is
 * how the first attempt at the whitespace row was caught: its anchor matched
 * twice, nothing was written, and the untouched tree's green was about to be
 * recorded as a measurement.
 *
 * **And the symmetric rule, for the other end of a control: restore from a
 * snapshot, never from version control, and assert the restore.** The column
 * above records that each plant landed; nothing in a control's output records
 * that its restore completed. The harness that produced this table first
 * reverted with `git checkout -- <file>`, which restores the committed file and
 * takes every uncommitted edit in it along — twice deleting the feature under
 * test, once the placeholder expansion above and once a set of review fixes,
 * **while printing exactly what a successful control prints.** Any undo with a
 * wider scope than the edit it undoes will eventually undo something else, and
 * a control is where nobody looks for collateral damage.
 *
 * **Two rows are green, and both are kept rather than dropped for not being
 * reds.** A control table in which every row confirms the author is a weaker
 * table than one that records what the guard gives up. Whitespace collapsing is
 * the only normalisation the comparison performs. The wrong-role row is the
 * price of expanding `{role}`: the sentence is real, so it passes, and the
 * paragraph it contradicts is not something a lexical check can see.
 * The five reds are the classes a laxer checker would have folded away: had
 * terminal punctuation been trimmed to let partial quotes through, rows four
 * and five would both read green and the docblock would have to admit it.
 *
 * Every red named `every quoted string is in messages/en.json` and nothing
 * else. The parser control named the other test and only it, which is what the
 * floors are for: with nothing extracted the quote check passes on an empty set
 * and agrees with itself perfectly.
 *
 * ## What counts as a quote here
 *
 * Double quotation marks only. Backticked spans are addresses and file names,
 * and are stripped before the split; bolded text is the manual's own emphasis
 * and is the companion sweep's business, not this one's.
 *
 * **So in these files quotation marks are reserved for the product's words, and
 * emphasis or mention needs another device** — italics, bold, or naming the
 * thing without marks. This is a constraint the guard creates rather than one
 * the manual arrived with, and the next author meets it as an unexplained red:
 * a heading reading `What "not allowed" looks like` was never a quotation, the
 * marks were doing the work of mention, and no lexical check can tell mention
 * from quotation. It was reworded for the guard, not for accuracy. That is the
 * price of the rule and it is worth naming, because somebody will otherwise
 * spend an afternoon looking for the screen that says "not allowed". At an eight-character
 * floor this manual holds 131 double-quoted occurrences, 107 of them distinct.
 * A count is a coverage claim only when the reader knows what was counted.
 *
 * Lexical and literal-local, like the guard in `error-strings-in-params`.
 */

const MANUAL = path.resolve(import.meta.dirname, "../..", "docs/manual");

/**
 * Floors, not counts.
 *
 * A regex that stops matching, a directory read that returns nothing, a strip
 * that eats the document — each of those makes a sweep find zero quotes and
 * agree with itself perfectly. These are what stop a silent pass. They are set
 * below the real figures so ordinary editing does not trip them, and far enough
 * above zero that a broken parse cannot clear them.
 *
 * **The chapter floor was 16 against exactly 16 files**, which is an equality
 * wearing a floor's name: consolidating two chapters would have reddened a test
 * whose stated job is catching a directory read that returned nothing. Twelve
 * is a floor. The real figures at the time of writing are 16 chapters, 131
 * quotes and 751 segments.
 */
const CHAPTER_FLOOR = 12;
const QUOTE_FLOOR = 100;

/** The shortest quote worth checking. Below this, a match is a coincidence. */
const MIN_QUOTE = 8;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Every string in the English catalogue, at any depth. */
function catalogueValues(node: unknown, into: string[] = []): string[] {
  if (typeof node === "string") into.push(node);
  else if (node && typeof node === "object")
    for (const value of Object.values(node)) catalogueValues(value, into);
  return into;
}

/**
 * The literal runs of the catalogue, with placeholders as the breaks.
 *
 * Text either side of a `{placeholder}` is still the product's, so each side is
 * a segment a quote may sit inside. The placeholder itself is a hole: nothing
 * the application substitutes into it is the product's words.
 */
function literalSegments(values: readonly string[]): string[] {
  const segments = new Set<string>();
  for (const value of values)
    for (const rendered of expand(collapse(value)))
      for (const part of rendered.split(/\{[^}]*\}/)) {
        const segment = collapse(part);
        if (segment.length >= MIN_QUOTE) segments.add(segment);
      }
  return [...segments];
}

/**
 * The placeholders whose values are a closed set the catalogue already holds.
 *
 * Read from the product's own constants rather than typed out here, so a
 * seventh role or a seventh status cannot leave this list behind. Everything
 * else stays a hole: see the docblock on why that line is where it is.
 */
const CLOSED: Record<string, string[]> = {
  role: ROLES.map((role) => en.roles[role].name),
  status: WORK_ORDER_STATUSES.map((status) => en.workOrderStatus[status]),
  language: locales.map((locale) => en.shell.language.options[locale]),
};

/** One string per combination of the closed placeholders a value carries. */
function expand(value: string): string[] {
  let rendered = [value];
  for (const [name, options] of Object.entries(CLOSED)) {
    const token = `{${name}}`;
    if (!rendered.some((candidate) => candidate.includes(token))) continue;
    rendered = rendered.flatMap((candidate) =>
      candidate.includes(token)
        ? options.map((option) => candidate.split(token).join(option))
        : [candidate],
    );
  }
  return rendered;
}

/** Fenced blocks and inline code are addresses and file names, not quotations. */
function withoutCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
}

/**
 * Quoted strings, taken by splitting on the quote character.
 *
 * Deliberately not a regex over pairs. `"Asset" and its tag, "Work order"` has
 * a scan matching the text *between* two quotations as though it were one, and
 * the first version of this sweep reported four phantom findings that way.
 * Splitting cannot mis-pair: odd indices are inside quotation marks.
 */
function quotedStrings(markdown: string): string[] {
  const parts = withoutCode(markdown).split('"');
  const found: string[] = [];
  for (let index = 1; index < parts.length; index += 2) {
    const quote = collapse(parts[index]!);
    if (quote.length >= MIN_QUOTE) found.push(quote);
  }
  return found;
}

/** The segment sharing the longest opening run with the quote, for the message. */
function nearest(quote: string, segments: readonly string[]): string {
  let best = "";
  let bestShared = 0;
  for (const segment of segments) {
    let shared = 0;
    while (
      shared < quote.length &&
      shared < segment.length &&
      quote[shared] === segment[shared]
    )
      shared += 1;
    if (shared > bestShared) {
      bestShared = shared;
      best = segment;
    }
  }
  return bestShared >= MIN_QUOTE ? best : "(nothing close in the catalogue)";
}

describe("the manual quotes the product, not itself", () => {
  const chapters = readdirSync(MANUAL).filter((name) => name.endsWith(".md"));
  const segments = literalSegments(catalogueValues(en));

  it("reads the whole manual, so an empty sweep cannot pass", () => {
    expect(chapters.length).toBeGreaterThanOrEqual(CHAPTER_FLOOR);
    expect(segments.length).toBeGreaterThan(400);
    // The expansion must actually have happened: this sentence exists only
    // because {role} was rendered, and it is the ruling this guard carries.
    expect(segments).toContain(
      "Auditor cannot do this. Switch role to continue.",
    );

    const quotes = chapters.flatMap((name) =>
      quotedStrings(readFileSync(path.join(MANUAL, name), "utf8")),
    );
    expect(quotes.length).toBeGreaterThanOrEqual(QUOTE_FLOOR);
  });

  it("every quoted string is in messages/en.json", () => {
    const wrong: string[] = [];

    for (const name of chapters)
      for (const quote of quotedStrings(
        readFileSync(path.join(MANUAL, name), "utf8"),
      ))
        if (!segments.some((segment) => segment.includes(quote)))
          wrong.push(
            `${name}\n    quoted:  "${quote}"\n    nearest: "${nearest(quote, segments)}"`,
          );

    expect(
      wrong,
      `A quotation mark in the manual promises the product's own words.\n\n${wrong.join("\n\n")}\n\nCompare the two lines above: a trailing comma where the catalogue ends in a full stop is a splice, a full stop the catalogue does not have is an added stop, and nothing close is an invention.`,
    ).toEqual([]);
  });
});
