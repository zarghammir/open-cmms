import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No hardcoded English, checked by reading the source rather than the screen.
 *
 * The translation sweep for WA-25 was verified in a running browser, which is
 * the right way to verify — and exactly why the two strings it missed were the
 * two nothing renders yet: a `Close` button behind a prop no call site sets,
 * and a default `aria-label` every call site happened to override. A string
 * that is unreachable today is a string that ships untranslated the first time
 * someone reaches it.
 *
 * So this check does not care whether a string is reachable. It reads every
 * component file and fails on visible text and on the accessible-name
 * attributes, wherever they are.
 */

/**
 * Everything that holds a screen. One root, because feature screens live under
 * `src/components/<module>`: a directory the check does not know about is a
 * directory the rule does not apply to.
 */
const ROOTS = ["src/components"].map((directory) =>
  path.resolve(import.meta.dirname, "../..", directory),
);

/** Attributes whose value a person reads or hears. */
const TEXT_ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"];

function tsxFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      return tsxFilesUnder(full);
    }
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

/** Comments may describe English strings; they are not English strings. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function relative(file: string): string {
  return path.relative(path.resolve(import.meta.dirname, "../.."), file);
}

/** `aria-label="Close"` — a literal where a catalogue lookup belongs. */
export function literalTextAttributes(source: string): string[] {
  const pattern = new RegExp(
    `\\b(${TEXT_ATTRIBUTES.join("|")})="([^"]*[A-Za-z]{2}[^"]*)"`,
    "g",
  );
  return [...withoutComments(source).matchAll(pattern)].map(
    (match) => `${match[1]}="${match[2]}"`,
  );
}

/**
 * `<Button>Close</Button>` — text between tags that is not an expression.
 *
 * Anything holding a brace, bracket, semicolon, colon or equals sign is
 * TypeScript that happened to sit between a `>` and a `<`, not JSX text.
 *
 * That exclusion is the check's blind spot, and it is worth knowing: a literal
 * carrying any of `: ; = ( ) [ ] { }` is skipped, so `<p>Note: overdue</p>`
 * passes. The check catches the plain labels that slip through a sweep; it is
 * not a substitute for reading the diff.
 */
export function literalJsxText(source: string): string[] {
  const pattern =
    />[ \t]*([^<>{}()[\];:=\n]*[A-Za-z]{2}[^<>{}()[\];:=\n]*)[ \t]*</g;
  return [...withoutComments(source).matchAll(pattern)]
    .map((match) => (match[1] ?? "").trim())
    .filter(
      (text) =>
        text.length > 0 &&
        // `Props<"a"> & VariantProps<…>` — a type intersection, not JSX text.
        !/^[&|,.]/.test(text) &&
        // `format.dateTime` and friends: a member expression, not a sentence.
        !/^[A-Za-z]+\.[A-Za-z]/.test(text) &&
        // `() => void | Promise<void | boolean>` — a union return type, where
        // the `>` of the arrow and the `<` of the generic look like tags with
        // text between them. Same family as the intersection above; WA-67 hit
        // the spelling it did not cover.
        //
        // The cost, stated: an interface label containing " | " would now be
        // skipped. Nothing in the catalogues uses a spaced pipe as punctuation,
        // and a label that did would be a separator drawn with a border rather
        // than typed into a string.
        !/\s\|\s/.test(text),
    );
}

describe("components never hold a user-facing string", () => {
  const files = ROOTS.flatMap((root) => tsxFilesUnder(root));

  it("finds the component files to check", () => {
    // Without this, an empty or mistyped directory would make every assertion
    // below pass while reading nothing at all.
    expect(files.length).toBeGreaterThan(30);

    // And each root contributes, so adding a directory that does not exist
    // cannot pass unnoticed.
    for (const root of ROOTS) {
      expect(
        tsxFilesUnder(root).length,
        `nothing scanned under ${root}`,
      ).toBeGreaterThan(0);
    }
  });

  it("has no literal text in an attribute a person reads or hears", () => {
    const offences = files.flatMap((file) =>
      literalTextAttributes(readFileSync(file, "utf8")).map(
        (found) => `${relative(file)}: ${found}`,
      ),
    );

    expect(offences).toEqual([]);
  });

  it("has no literal text between tags", () => {
    const offences = files.flatMap((file) =>
      literalJsxText(readFileSync(file, "utf8")).map(
        (found) => `${relative(file)}: ${found}`,
      ),
    );

    expect(offences).toEqual([]);
  });

  it("catches the two strings this check was written for", () => {
    // The deletion control: the patterns are asserted against the exact code
    // that shipped, so the check cannot quietly stop working.
    expect(
      literalTextAttributes(`<nav aria-label="breadcrumb" data-slot="x" />`),
    ).toEqual(['aria-label="breadcrumb"']);
    expect(literalJsxText(`<Button variant="outline">Close</Button>`)).toEqual([
      "Close",
    ]);
    // A union return type is not text between tags. Without this the check
    // fires on `ConfirmDialog`'s own props, which is how it was found.
    expect(
      literalJsxText(`  onConfirm: () => void | Promise<void | boolean>;`),
    ).toEqual([]);
    // And the exclusion is narrow: a real label still fails.
    expect(literalJsxText(`<Button>Save changes</Button>`)).toEqual([
      "Save changes",
    ]);

    // And it does not fire on the translated forms that replaced them.
    expect(literalTextAttributes(`<nav aria-label={t("label")} />`)).toEqual(
      [],
    );
    expect(
      literalJsxText(`<Button variant="outline">{t("close")}</Button>`),
    ).toEqual([]);
  });
});
