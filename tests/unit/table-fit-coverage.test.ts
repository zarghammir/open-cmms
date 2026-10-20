import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every register that draws a table has a table-fit measurement.
 *
 * WA-107. The Users register ran 1604px wide inside a 1415px wrapper and
 * fourteen tests stayed green, because the page-level sweep cannot see a table
 * that overflows inside an `overflow-x-auto` box — the document never scrolls
 * sideways, so `hasHorizontalOverflow` is false on both sides of the defect.
 * `tests/fixtures/table-fit.ts` measures it correctly.
 *
 * The gap that let it ship was not the missing assertion. It was that **nothing
 * said which screens had one**. A register with no fit spec and a register with
 * a passing fit spec look identical from outside: both are quiet. So this test
 * reads the source for the call sites rather than trusting a list somebody
 * maintains, and fails naming any register that has no measurement.
 *
 * It is deliberately a source-reading test and not a browser one. A browser
 * test can only measure the screens it was told to open, which is the very
 * thing that was wrong.
 */

const COMPONENTS = "src/components";

/** A register's source file, and where its measurement lives. */
type Coverage = { spec: string } | { gap: string };

/**
 * What the map is for: a call site may be covered by a spec, or be a known gap
 * that names its ticket. It may not simply be absent, and it may not carry a
 * gap with no owner — "flagged, and nobody owns it" is how WA-175 was dropped
 * on a neighbouring project.
 */
const COVERAGE: Record<string, Coverage> = {
  "assets/assets-screen.tsx": { spec: "tests/e2e/assets-table.spec.ts" },
  "documents/documents-screen.tsx": {
    spec: "tests/e2e/documents-table.spec.ts",
  },
  "inventory/parts-screen.tsx": { spec: "tests/e2e/inventory-table.spec.ts" },
  "maintenance/plans-screen.tsx": { spec: "tests/e2e/maintenance.spec.ts" },
  "maintenance/schedules-screen.tsx": { spec: "tests/e2e/maintenance.spec.ts" },
  "work-orders/work-order-queue.tsx": {
    spec: "tests/e2e/work-order-queue.spec.ts",
  },
  // Reports draws a bare shadcn <Table>, so it has no [data-slot="data-table"]
  // and the shared measurement could not find it at all. WA-107 gave
  // `measureTableFit` a root argument and this spec passes the container.
  "reports/reports-screen.tsx": { spec: "tests/e2e/reports-table.spec.ts" },
  /*
   * WA-22's people register, which did not exist on main when this map was
   * written — the map found it the first time the two branches met, which is
   * the point of reading the source rather than trusting a list.
   *
   * Its spec measures at 1440 and 1024 and skips 390, where the register is
   * cards and there is no table to fit. The screen is also why WA-107 exists:
   * it ran 1604px wide inside a 1415px wrapper with fourteen tests green.
   */
  "users/people-table.tsx": { spec: "tests/e2e/users-screen.spec.ts" },
  /*
   * The import wizard draws three tables and none of them is measured.
   *
   * They are wizard steps rather than registers — reached only by uploading a
   * file and walking through — so none was on WA-107's list, which named the
   * registers. This test found them; they were on nobody's list before it ran.
   *
   * WA-108 owns them, after WA-106 settles the preview's row count. Whoever
   * takes it replaces these three entries with the spec that measures them.
   */
  "import/mapping-step.tsx": { gap: "WA-108" },
  "import/preview-step.tsx": { gap: "WA-108" },
  "import/report-step.tsx": { gap: "WA-108" },
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test."))
      out.push(path);
  }
  return out;
}

/**
 * Files that render the shared table, read from the source.
 *
 * The character class has to allow `<`. `preview-step.tsx` calls it as
 * `<DataTable<PreviewRow>`, a generic JSX call, and the first version of this
 * pattern required whitespace or `>` after the name — so it silently skipped
 * that call site, and the entry for it then looked stale rather than uncovered.
 * A detector that misses a call site is the same defect as a sweep that cannot
 * see a table, one level up.
 *
 * `<DataTableFeatures` and `<DataTableSkeleton` do not match: the next
 * character is a letter, which the class excludes.
 */
function dataTableCallSites(): string[] {
  return sourceFiles(COMPONENTS)
    .filter((file) => /<DataTable[\s/<>]/.test(readFileSync(file, "utf8")))
    .map((file) => file.slice(COMPONENTS.length + 1))
    .sort();
}

/** Screens that draw a table without going through `DataTable`. */
function bareTableCallSites(): string[] {
  return sourceFiles(COMPONENTS)
    .filter((file) => {
      // The shared component is the implementation, not a call site: it is
      // where `<Table>` is drawn for everybody, and measuring it would mean
      // measuring a screen that does not exist.
      if (file.includes("/data-table/")) return false;

      const source = readFileSync(file, "utf8");
      if (/<DataTable[\s/<>]/.test(source)) return false;
      return (
        /<Table>/.test(source) && /from "@\/components\/ui\/table"/.test(source)
      );
    })
    .map((file) => file.slice(COMPONENTS.length + 1))
    .sort();
}

describe("table-fit coverage", () => {
  const dataTable = dataTableCallSites();
  const bare = bareTableCallSites();
  const all = [...dataTable, ...bare].sort();

  /**
   * The floor. A regex that matched nothing would make every assertion below
   * vacuously true, and this test would then agree with itself perfectly while
   * measuring no screens at all — the exact shape of the defect it guards.
   */
  it("found the call sites it is meant to read", () => {
    expect(
      dataTable.length,
      "no <DataTable> call sites were found in the source; the pattern has stopped matching",
    ).toBeGreaterThanOrEqual(7);

    expect(
      bare.length,
      "no bare <Table> screens were found; the pattern has stopped matching",
    ).toBeGreaterThanOrEqual(1);
  });

  it("has a measurement, or a ticket, for every register that draws a table", () => {
    const missing = all.filter((file) => !(file in COVERAGE));

    expect(
      missing,
      `these screens draw a table and nothing measures whether it fits: ${missing.join(", ")}. Add a table-fit spec, or an entry naming the ticket that will.`,
    ).toEqual([]);
  });

  it("carries no entry for a screen that no longer draws a table", () => {
    const stale = Object.keys(COVERAGE).filter((file) => !all.includes(file));

    expect(
      stale,
      `these entries name screens that no longer draw a table: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("names a spec that exists and actually asserts the fit", () => {
    for (const [file, coverage] of Object.entries(COVERAGE)) {
      if (!("spec" in coverage)) continue;

      expect(
        existsSync(coverage.spec),
        `${file}: ${coverage.spec} is missing`,
      ).toBe(true);

      // Naming a spec is not being measured by it. The spec has to call the
      // shared assertion, or the entry is a promise nothing keeps.
      expect(
        readFileSync(coverage.spec, "utf8"),
        `${file}: ${coverage.spec} never calls expectTableFits, so it does not measure the fit`,
      ).toContain("expectTableFits");
    }
  });

  it("gives every gap an owner", () => {
    for (const [file, coverage] of Object.entries(COVERAGE)) {
      if (!("gap" in coverage)) continue;

      expect(
        coverage.gap,
        `${file}: a gap must name the ticket that closes it, not just say there is one`,
      ).toMatch(/^WA-\d+$/);
    }
  });
});
