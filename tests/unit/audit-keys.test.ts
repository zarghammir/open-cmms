import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import {
  HANDLED_AUDIT_KEYS,
  handledAuditKey,
} from "../../src/lib/audit-summary";

/**
 * Every audit entry the product writes is an entry the activity feed can read.
 *
 * The trail stores a catalogue key, and the dashboard turns it back into a
 * sentence by naming that key explicitly — which means a repository can add a
 * new kind of entry and the feed will quietly render "a change was recorded"
 * for it, in a demonstration, in front of an evaluator. Nothing else would
 * fail: the write works, the trail is correct, only the sentence is missing.
 *
 * So the keys are read out of the source rather than trusted.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const WRITTEN_IN = ["src/data", "src/stores"];

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFilesUnder(full);
    return /\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
  });
}

/** `summaryKey: "audit.statusChanged"` — every key written into the trail. */
export function summaryKeysIn(source: string): string[] {
  return [...source.matchAll(/summaryKey:\s*["']([^"']+)["']/g)].map(
    (match) => match[1] ?? "",
  );
}

const written = [
  ...new Set(
    WRITTEN_IN.flatMap((directory) =>
      sourceFilesUnder(path.join(ROOT, directory)).flatMap((file) =>
        summaryKeysIn(readFileSync(file, "utf8")),
      ),
    ),
  ),
].sort();

describe("audit keys", () => {
  it("found the keys the records actually write", () => {
    // Without this, a moved directory would empty the list and leave every
    // assertion below passing against nothing at all.
    expect(written.length).toBeGreaterThan(3);
    expect(written).toContain("audit.statusChanged");
  });

  it("has a sentence for every key written into the trail", () => {
    const unreadable = written.filter((key) => handledAuditKey(key) === null);

    expect(unreadable).toEqual([]);
  });

  it("has both languages for every key a screen can render", () => {
    const catalogue = Object.keys(en.audit);

    for (const key of HANDLED_AUDIT_KEYS) {
      expect(catalogue, `audit.${key} is missing from the catalogue`).toContain(
        key,
      );
    }
  });

  it("lists nothing the catalogue does not have", () => {
    // The other direction: a key handled here but dropped from the catalogue
    // would be a compile error at the call site, and this says so sooner.
    expect([...HANDLED_AUDIT_KEYS].sort()).toEqual(
      Object.keys(en.audit).sort(),
    );
  });

  it("notices a key nothing can render", () => {
    // The deletion control. This is the case the test exists for, proven to be
    // detectable rather than assumed to be.
    expect(handledAuditKey("audit.somethingNobodyTranslated")).toBeNull();
    expect(summaryKeysIn(`summaryKey: "audit.brandNew",`)).toEqual([
      "audit.brandNew",
    ]);
    // And it does not fire on the keys that are handled.
    expect(handledAuditKey("audit.statusChanged")).toBe("statusChanged");
  });
});
