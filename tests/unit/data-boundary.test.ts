import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pages and components never reach past the boundary.
 *
 * The flow is fixed: a screen asks a hook, the hook asks a repository, and the
 * repository is the only thing that knows the records live in a store in the
 * browser. Phase 2 replaces the repositories with REST calls, and the promise
 * that no screen changes is only worth anything if no screen ever imported the
 * seed, the store or a repository directly.
 *
 * It is checked by reading the source rather than by discipline, because one
 * import of `@/data/seed` in a table is invisible in review and expensive in
 * Phase 2.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
// Feature screens live under `src/components/<module>` rather than in a
// directory of their own, so that adding one cannot put it outside this guard.
// That is the reason for the convention, not a detail of it.
const GUARDED = ["src/app", "src/components"];

/** What a screen may not import, by the shape of the specifier. */
const FORBIDDEN = [
  { pattern: /(^|\/)stores(\/|$)/, why: "the store" },
  { pattern: /data\/seed(\/|$)/, why: "the seed" },
  { pattern: /data\/mock(\/|$)/, why: "mock data" },
  { pattern: /data\/repositories(\/|$)/, why: "a repository" },
];

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFilesUnder(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

/**
 * Every import specifier in a file, however it is written.
 *
 * The optional `\(?` is the part that matters. Without it the pattern only
 * sees `import` when a quote follows it, so `await import("…")` and
 * `dynamic(() => import("…"))` are invisible — and `next/dynamic` is exactly
 * how a heavy table gets lazy-loaded, which is the shape the next tickets
 * bring. A guard blind to the syntax its own breach would be written in is
 * not a guard.
 */
export function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(
      /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["']([^"']+)["']/g,
    ),
  ].map((match) => match[1] ?? "");
}

export function boundaryBreaches(source: string): string[] {
  return importSpecifiers(source).flatMap((specifier) => {
    const found = FORBIDDEN.find((rule) => rule.pattern.test(specifier));
    return found ? [`${specifier} (${found.why})`] : [];
  });
}

describe("the data boundary", () => {
  const files = GUARDED.flatMap((directory) =>
    sourceFilesUnder(path.join(ROOT, directory)),
  );

  it("found the pages and components to check", () => {
    // Without this, a renamed directory would leave the list empty and the
    // assertion below would pass while reading nothing.
    expect(files.length).toBeGreaterThan(50);

    // And every guarded directory contributes, so adding one to the list
    // without it existing cannot pass unnoticed.
    for (const directory of GUARDED) {
      expect(
        files.filter((file) => file.includes(`/${directory.split("/")[1]}/`))
          .length,
        `nothing scanned under ${directory}`,
      ).toBeGreaterThan(0);
    }
  });

  it("holds: no page or component imports the seed, the store or a repository", () => {
    const breaches = files.flatMap((file) =>
      boundaryBreaches(readFileSync(file, "utf8")).map(
        (breach) => `${path.relative(ROOT, file)}: ${breach}`,
      ),
    );

    expect(breaches).toEqual([]);
  });

  it("notices a breach, however it is written", () => {
    // The deletion control, one line per way a screen could actually reach
    // past the boundary. The three dynamic forms are the ones the first
    // version of this pattern could not see: a lazy-loaded table is written
    // exactly like that, and tables are what the next tickets add.
    const store = "@/stores/demo-store (the store)";

    expect(
      boundaryBreaches(`import { useDemoStore } from "@/stores/demo-store";`),
    ).toEqual([store]);
    expect(
      boundaryBreaches(`export { useDemoStore } from "@/stores/demo-store";`),
    ).toEqual([store]);
    expect(boundaryBreaches(`import "@/stores/demo-store";`)).toEqual([store]);
    expect(boundaryBreaches(`require("@/stores/demo-store");`)).toEqual([
      store,
    ]);
    expect(
      boundaryBreaches(`const s = await import("@/stores/demo-store");`),
    ).toEqual([store]);
    expect(
      boundaryBreaches(
        `const Table = dynamic(() => import("@/stores/demo-store"));`,
      ),
    ).toEqual([store]);
    expect(
      boundaryBreaches(`const seed = await import( "@/data/seed" );`),
    ).toEqual(["@/data/seed (the seed)"]);

    expect(
      boundaryBreaches(`import { buildSeed } from "../../data/seed";`),
    ).toEqual(["../../data/seed (the seed)"]);
    expect(
      boundaryBreaches(
        `import { createRepositories } from "@/data/repositories";`,
      ),
    ).toEqual(["@/data/repositories (a repository)"]);
    expect(boundaryBreaches(`import x from "@/data/mock/assets";`)).toEqual([
      "@/data/mock/assets (mock data)",
    ]);
  });

  it("leaves the sanctioned route alone", () => {
    expect(
      boundaryBreaches(`
        import { useRepositories } from "@/hooks/use-demo-data";
        import type { WorkOrder } from "@/domain/types";
        import { can } from "@/domain/constants/roles";
        const Panel = dynamic(() => import("@/components/shared/module-panel"));
      `),
    ).toEqual([]);
  });
});
