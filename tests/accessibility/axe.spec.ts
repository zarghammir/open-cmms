import { readdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { MODULES } from "@/domain/constants/navigation";
import {
  VIEWPORTS,
  animationsSettled,
  failTheNextRead,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/** A real tag, so the label pages are scanned with a record on them. */
const assetTag = buildSeed(new Date()).assets[0]!.assetTag;
/** A part the seed has moved, so the ledger is drawn rather than empty. */
const PART_NUMBER = (() => {
  const seed = buildSeed(new Date());
  const found = seed.parts.find((part) =>
    seed.inventoryTransactions.some((one) => one.partId === part.id),
  );
  if (!found) throw new Error("The seed holds no part with a movement");
  return found.partNumber;
})();

/**
 * WCAG 2.1 AA is part of acceptance, so the scan runs on the shell in both
 * languages and fails on anything serious or critical.
 */
const DESK_PAGES = [
  "/en/dashboard",
  "/fr/dashboard",
  "/en/work-orders",
  "/fr/work-orders",
  "/en/settings",
  "/fr/settings",
  `/en/assets/${assetTag}/label`,
  `/fr/assets/${assetTag}/label`,
];

/**
 * The two screens WA-27 builds, at both widths.
 *
 * A table and a form are where accessibility goes wrong, and the phone width is
 * where reflow goes wrong, so these are scanned at 1440 and at 390 rather than
 * only at the project default.
 */
const RECORD_PAGES = [
  "/en/assets",
  "/fr/assets",
  "/en/work-orders",
  "/fr/work-orders",
  // WA-21's library is a table like the others, and 1024 is the width where
  // it drops its Format column — a different set of cells and so a different
  // tree from either of the other two widths.
  "/en/documents",
  "/fr/documents",
  // WA-22's people register, which is a table like the others — and below it a
  // role matrix that is a real `<table>` with headers on both axes, thirteen
  // rows against six columns, redrawn as one block per role below `md`. Two
  // different trees at two of these widths, and the phone one is not a
  // narrower version of the desktop one.
  "/en/users",
  "/fr/users",
];

/*
 * A real number from the same generator the browser seeds itself with, rather
 * than one typed in: a scan of a page that resolved to nothing would be a scan
 * of `RecordMissing`, which is the test below and not this one.
 */
const DETAIL_NUMBER = buildSeed(new Date()).workOrders[0]!.number;
/** An order that can still receive work, for the controls only a live one has. */
const LIVE_NUMBER = buildSeed(new Date()).workOrders.find(
  (order) => order.status === "inProgress",
)!.number;

const FIELD_PAGES = [
  "/en/my-work",
  "/fr/my-work",
  // Scanning and counting are done one-handed in a corridor, so they are
  // scanned at the phone width with the rest of the field view.
  "/en/my-work/scan",
  "/fr/my-work/scan",
  "/en/inventory/verify",
  "/fr/inventory/verify",
];

/**
 * What the wait saw, this worker, across every scan it ran.
 *
 * `fullyParallel` is on, so tests in this file are spread across workers and
 * each gets its own copy of these. That is why the floor below is conditional:
 * a worker that happened to run none of the opening scans has nothing to say,
 * and asserting on it would be asserting on which tests the scheduler handed
 * it — flaky for a reason that has nothing to do with the code.
 */
let openingScans = 0;
let animationsWaitedOn = 0;

/**
 * Which widths a page is scanned at, and why a page might be scanned at fewer.
 *
 * **WA-117 is what this exists for.** Settings sat in a list scanned with no
 * viewport set — one width — while the register screens got three, and a
 * serious `scrollable-region-focusable` finding lived on Settings at 390
 * behind 114 green tests. The suite's silence about a width it never visited
 * is an absence nobody measured for, not a pass.
 *
 * So every page names its widths. `ALL_WIDTHS` is the default and the honest
 * answer for anything a desk role opens; a shorter list carries a reason, and
 * the test below fails on a page offering neither. A list split into two
 * groups with different rigour, and no statement of which group a new page
 * joins, is the shape that produced this.
 */
const ALL_WIDTHS = [
  VIEWPORTS.desktop,
  VIEWPORTS.tablet,
  VIEWPORTS.phone,
] as const;

interface ScannedPage {
  path: string;
  widths: readonly { width: number; height: number }[];
  /** Required whenever `widths` is shorter than `ALL_WIDTHS`. */
  why?: string;
}

async function scan(
  page: Page,
  { opening = false }: { opening?: boolean } = {},
) {
  /*
   * Let whatever is opening finish opening, before reading any colours.
   *
   * This lives inside `scan` rather than at the six call sites that open a
   * menu, a facet, a dialog or the bell, because the next scan somebody adds
   * will open something too and will not remember a rule written in another
   * test. A guard every caller has to opt into is a guard that eventually one
   * of them does not.
   *
   * On a screen at rest it finds nothing running and returns immediately, so
   * the scans that do not open anything pay nothing for it. See
   * `animationsSettled` for why the wait is on the document rather than on the
   * element that was clicked — Radix animates a portal, not the trigger.
   */
  const waitedOn = await animationsSettled(page);
  if (opening) {
    openingScans += 1;
    animationsWaitedOn += waitedOn;
  }

  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

test.afterAll(() => {
  /*
   * The floor on the guard itself, and the reason it is here rather than at a
   * call site.
   *
   * `animationsSettled` returns a count that nothing was reading. If
   * `document.getAnimations()` ever came back empty — a Chromium change, or
   * the menus refactored to animate by some means it does not report — the
   * helper would return 0 instantly, `scan()` would behave exactly as it did
   * before WA-96, and the contrast flake would come back with this file
   * looking as though it handled it. The 6 → 0 measurement on the pull request
   * is a proof about one afternoon, not a standing one.
   *
   * It only has to hold ONCE across the opening scans this worker ran, so a
   * fast machine finishing a transition early cannot redden it: every opening
   * scan would have to see nothing.
   *
   * ZERO IS THE RIGHT FLOOR HERE, deliberately, and it is the one place in
   * this file where that is true. The claim is "the API still reports
   * animations at all"; one is as good as six, and a machine that finishes a
   * transition before the read is a machine that legitimately saw fewer. A
   * higher floor would redden on speed rather than on breakage, which is the
   * flake this whole mechanism exists to remove.
   */
  if (openingScans === 0) return;

  expect(
    animationsWaitedOn,
    `${openingScans} scans opened something and the wait saw no animation in any of them — ` +
      "either nothing animates any more, or `document.getAnimations()` has stopped reporting it",
  ).toBeGreaterThan(0);
});

/**
 * And the mechanism itself, proved against an animation this test plants.
 *
 * The floor above says the real menus still animate. This says the helper can
 * see an animation at all and actually waits for it — two different failures,
 * and this one is deterministic because the duration is ours rather than a
 * component's. A browser that stopped reporting animations reddens here
 * immediately, with a sentence naming the API rather than six contrast
 * violations somewhere else.
 */
test("the wait can see an animation, and waits for it", async ({ page }) => {
  await page.goto("/en/dashboard");

  /*
   * The page's own count first, and this is the difference between a floor of
   * zero and a floor that means something.
   *
   * `toBeGreaterThan(0)` was true of a helper that never saw the animation
   * this test plants, as long as the dashboard happened to be animating
   * anything of its own — a skeleton, a chip, a toast on its way out. The
   * plausible wrong answer here is small and non-zero, which is exactly the
   * case a zero floor cannot see. Measured against the ambient count, the
   * claim becomes "it saw MORE than what was already there", which is the
   * claim the test is named for.
   */
  const ambient = await animationsSettled(page);

  const startedAt = Date.now();
  await page.evaluate(() => {
    const target = document.createElement("div");
    target.id = "wa-96-control";
    document.body.append(target);
    target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  });

  const waitedOn = await animationsSettled(page);

  expect(
    waitedOn,
    `the helper reported ${waitedOn} animations and the page was already at ${ambient}, so it did not see the one this test planted`,
  ).toBeGreaterThan(ambient);
  expect(
    Date.now() - startedAt,
    "the helper returned before the animation it reported could have finished",
  ).toBeGreaterThanOrEqual(300);
  expect(
    await page.evaluate(
      () =>
        document
          .querySelector("#wa-96-control")
          ?.getAnimations()
          .every((animation) => animation.playState === "finished") ?? false,
    ),
    "the animation was still running when the wait returned",
  ).toBe(true);
});

const DESK_SCANS: ScannedPage[] = [
  ...DESK_PAGES.map((path) => ({ path, widths: ALL_WIDTHS })),
  /*
   * `/inspections` was routed and scanned by nothing, at any width — found by
   * the coverage test below the first time it ran, which is what the coverage
   * test is for. It joins at three widths like every other desk screen.
   */
  { path: "/en/inspections", widths: ALL_WIDTHS },
  { path: "/fr/inspections", widths: ALL_WIDTHS },
  /*
   * And `/waiting-to-send`, which I first excused as "scanned with the outbox
   * open in its own block". It is not, and the check below caught the excuse
   * rather than the route — I wrote that line from an assumption and the
   * verification refused it. Two routes were unscanned, not one.
   */
  { path: "/en/waiting-to-send", widths: ALL_WIDTHS },
  { path: "/fr/waiting-to-send", widths: ALL_WIDTHS },
];

const FIELD_SCANS: ScannedPage[] = FIELD_PAGES.map((path) => ({
  path,
  widths: [VIEWPORTS.phone],
  why: "the field view exists for a phone; the desk shell is what the other widths render and it is scanned above",
}));

/**
 * Every module route the application serves, read from the filesystem.
 *
 * The floor below asserts the sweep is not empty. That is necessary and it is
 * not enough: a page added tomorrow simply never appears in either list, the
 * count stays above its minimum, and the floor is satisfied by the pages that
 * were already there — a registry test cannot see a missing entry by reading
 * the registry.
 *
 * So completeness is asserted from the other end: the routes on disk. A new
 * module folder fails this until somebody decides which widths it is scanned
 * at, which is the decision WA-117 found nobody had made for Settings.
 */
/**
 * The paths the two bespoke blocks further down open, declared rather than built from
 * a locale inside the block.
 *
 * They are here so the coverage test can ask a STRUCTURAL question — is this
 * module in a list some scan consumes — instead of asking whether its name
 * appears somewhere in this file. See that test for why the difference
 * matters.
 */
/**
 * The refusal screen, which nothing scanned until WA-66 drew one.
 *
 * Every scan above loads a page whose records arrived. This state is the one
 * where they did not, and it is a *different tree*: the page's own content is
 * replaced by a status panel, so the headings, the landmarks and the only
 * remaining control all change. A screen nobody scans is a screen whose
 * heading order and contrast nobody has checked, and this one is reached by
 * the person least able to work around it — someone whose browser has just
 * stopped answering.
 *
 * Both languages, because every word of it is translated, and both shells,
 * because a technician meets it on a phone in a plant room while a coordinator
 * meets it at a desk. The panel carries `role="status"` and `aria-live`, so it
 * is announced rather than only drawn; what these scans add is that the rest of
 * the screen around it is still sound.
 *
 * The state cannot be planted: it exists only because a real read really
 * failed, which is why `failTheNextRead` runs before the navigation and why
 * the marker is asserted before the scan. A page that never booted would agree
 * with a clean scan and prove nothing.
 */
for (const locale of ["en", "fr"] as const) {
  for (const [where, path, size] of [
    ["desk", `/${locale}/dashboard`, VIEWPORTS.desktop],
    ["field", `/${locale}/my-work/scan`, VIEWPORTS.phone],
  ] as const) {
    test(`the unreadable-records refusal has no serious accessibility violations: ${where}, ${locale}`, async ({
      context,
      page,
    }) => {
      await page.setViewportSize(size);
      // Asserted, not assumed, as everywhere else in this file: a scan that
      // silently ran at the project default would pass while testing the
      // wrong width.
      expect(page.viewportSize()).toEqual(size);
      await useRole(context, where === "field" ? "technician" : "auditor");
      await failTheNextRead(page);
      await page.goto(path);

      await expect(
        page.locator('[data-demo-status="unreadable"]'),
        "the forced failure never reached the store: this scan is of the wrong screen",
      ).toBeAttached({ timeout: 15_000 });
      // And the panel itself, so the scan is of the refusal rather than of
      // whatever was on screen the instant the status flipped.
      await expect(
        page.locator('[data-slot="records-unreadable"]'),
      ).toBeVisible();

      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/*
 * WA-22's two screens, scanned at the three widths the registers are.
 *
 * They are **not** in `RECORD_PAGES` because that list's wait is for a data
 * table or a form, and neither screen is either: Facilities is a tree of
 * disclosures and Reports draws the plain table primitive. Adding them there
 * failed twelve times on the wait rather than on anything axe had to say —
 * a wait for the wrong content is not a finding about the page.
 *
 * Each waits for what its own screen draws, which is the rule for every click
 * and every scan here.
 */
const WA22_PAGES = [
  { path: "/en/facilities", ready: "summary" },
  { path: "/fr/facilities", ready: "summary" },
  /*
   * `table, li` for the reports, because at 390 a report is not a table — it
   * is cards, by the same rule every register follows. Waiting for `table`
   * alone failed at that one width for the second time in this branch: the
   * first was a screenshot helper waiting for a table the phone correctly does
   * not draw. A wait written for one width is a wait that lies at another.
   */
  { path: "/en/reports", ready: "table, [data-slot='card'], li" },
  { path: "/fr/reports", ready: "table, [data-slot='card'], li" },
] as const;

const PM_PAGES = [
  "/en/preventive-maintenance",
  "/fr/preventive-maintenance",
] as const;

const NOTIFICATION_PAGES = [
  "/en/my-notifications",
  "/fr/my-notifications",
] as const;

/**
 * The declared path for a locale, or a loud failure.
 *
 * Throwing rather than falling back to a built string is the point: it makes
 * the list load-bearing. Remove an entry and the scan that needed it stops,
 * instead of quietly navigating somewhere the coverage test cannot see.
 */
function declaredPath(paths: readonly string[], locale: "en" | "fr"): string {
  const found = paths.find((one) => one.startsWith(`/${locale}/`));
  if (!found) {
    throw new Error(`no ${locale} path is declared for this scan`);
  }
  return found;
}

const ROUTED_MODULES = readdirSync(
  // `process.cwd()`, not `import.meta.dirname`: Playwright transpiles specs to
  // CommonJS, where `import.meta` does not exist, and the runner starts at the
  // project root. `import.spec.ts` carries the same note for the same reason.
  path.join(process.cwd(), "src/app/[locale]/(app)"),
  { withFileTypes: true },
)
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
  .map((entry) => entry.name)
  .sort();

/**
 * Every path any scan in this file opens, as one list.
 *
 * Built from the lists the scans themselves iterate — the desk and field
 * sweeps, the record pages, WA-22's two screens, and the two blocks that
 * declare their own paths above. A module is covered when it appears HERE,
 * which is the same question a scan answers.
 */
const SCANNED_PATHS: readonly string[] = [
  ...DESK_SCANS.map((entry) => entry.path),
  ...FIELD_SCANS.map((entry) => entry.path),
  ...RECORD_PAGES,
  ...WA22_PAGES.map((entry) => entry.path),
  ...PM_PAGES,
  ...NOTIFICATION_PAGES,
];

/** The module registry's own answer to "what does this application route". */
const REGISTERED_MODULES = MODULES.map((module) =>
  module.href.replace(/^\//, ""),
).sort();

test("the module registry and the routes on disk agree", () => {
  /*
   * THE POPULATION, FROM BOTH ENDS, AND NO TYPED NUMBER.
   *
   * This used to be `expect(ROUTED_MODULES.length).toBeGreaterThan(10)` — a
   * literal floor, which is the same hatch as the exemption map wearing
   * arithmetic instead of prose: with fourteen modules, somebody can drop
   * three and stay green.
   *
   * There is no floor now because there is no need for one. The registry and
   * the directory listing are independent sources for the same fact, so each
   * is the other's floor: a `readdirSync` that returns nothing fails against
   * the registry, and a module added to the registry with no route fails
   * against the disk. Neither can shrink quietly.
   */
  expect(ROUTED_MODULES).toEqual(REGISTERED_MODULES);
});

test("the sweep covers every module the application routes", () => {
  /*
   * THIS CHECK USED TO ASK THE WRONG QUESTION, AND IT IS THE REASON THERE IS
   * NO EXEMPTION MAP HERE ANY MORE.
   *
   * A module that no sweep list held could be excused by naming it in a
   * `COVERED_ELSEWHERE` map, and the excuse was verified with
   * `source.includes("/" + module)` — that the module's name appears
   * somewhere in this file's text. The claim it stood for is "this module is
   * scanned somewhere in this file". Those are different claims, and a
   * comment naming the route satisfies the first while the second is false.
   * So would a helper that navigates there without scanning, or a skipped
   * block.
   *
   * That check did once catch a real excuse — `waiting-to-send` was scanned
   * nowhere and the line saying otherwise was mine — but it caught an excuse
   * *wholly absent from the file*. It could never catch the case the map will
   * actually produce: somebody deletes a scan and leaves the comment above
   * it. `my-notifications` rested on exactly one mention, so that deletion
   * would have left the check green and the module unscanned.
   *
   * A map with a verification on it stops being read, which makes a
   * verification that cannot verify worse than none.
   *
   * So there is no map. Every module is in a list some scan iterates, and
   * this asks for membership of that list. A module that genuinely cannot be
   * scanned has to be argued for rather than excused in a sentence — the test
   * goes red and somebody has the conversation.
   */
  const scanned = new Set(
    SCANNED_PATHS.map((one) => one.split("/")[2]).filter(Boolean),
  );

  const unscanned = REGISTERED_MODULES.filter((module) => !scanned.has(module));

  expect(
    unscanned,
    `these routes are served and no scan in this file opens them: ${unscanned.join(", ")}. Add each to the list its scan iterates — a comment naming the route is not coverage.`,
  ).toEqual([]);
});

test("every module is scanned in both languages", () => {
  /*
   * The other typed number, also gone. It was
   * `expect(SCANNED_PATHS.length).toBeGreaterThan(20)`, a belt against a
   * truncated union — and the same literal in the same disguise.
   *
   * What it was really protecting is this property, which is derived from the
   * registry and is worth more than a count: the two catalogues are separate
   * files and a screen can be correct in one language and broken in the
   * other, so a module scanned only in English is a module half scanned. A
   * union that lost half its entries fails here by name rather than by
   * arithmetic.
   */
  const missing = REGISTERED_MODULES.flatMap((module) =>
    (["en", "fr"] as const)
      .filter(
        (locale) =>
          !SCANNED_PATHS.some((one) => one.startsWith(`/${locale}/${module}`)),
      )
      .map((locale) => `${module} (${locale})`),
  );

  expect(
    missing,
    `these modules are scanned in one language only: ${missing.join(", ")}`,
  ).toEqual([]);
});

test("every page in the sweep declares the widths it is scanned at", () => {
  /*
   * The instrument's own floor. A page added without a width choice is the
   * defect WA-117 was — not a wrong answer, an unasked question. An empty
   * list would satisfy every assertion below it, so the population is
   * checked too.
   *
   * Derived, not typed. This was `toBeGreaterThan(8)`, the third literal
   * floor in this file and the same hatch as the other two: a number nobody
   * recomputes lets the list shrink to just above it and stay green. The two
   * page lists these scans are built from are the independent source, so
   * every path in them has to be here — an emptied or truncated sweep fails
   * by NAME rather than by arithmetic.
   */
  const all = [...DESK_SCANS, ...FIELD_SCANS];
  const declared = all.map((entry) => entry.path);
  const dropped = [...DESK_PAGES, ...FIELD_PAGES].filter(
    (page) => !declared.includes(page),
  );
  expect(
    dropped,
    `these pages are listed for scanning and the sweep does not carry them: ${dropped.join(", ")}`,
  ).toEqual([]);

  for (const entry of all) {
    expect(entry.widths.length, `${entry.path} has no widths`).toBeGreaterThan(
      0,
    );
    if (entry.widths.length < ALL_WIDTHS.length) {
      expect(
        entry.why,
        `${entry.path} is scanned at ${entry.widths.length} of ${ALL_WIDTHS.length} widths and gives no reason`,
      ).toBeTruthy();
    }
  }
});

for (const { path, widths } of DESK_SCANS) {
  for (const size of widths) {
    test(`desk view has no serious accessibility violations: ${path} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      // Asserted rather than assumed: a scan that silently ran at the project
      // default would satisfy everything below while measuring one width three
      // times, which is the shape WA-117 was.
      expect(page.viewportSize()).toEqual(size);
      await page.goto(path);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/*
 * Tablet as well as desktop and phone.
 *
 * The register screens are scanned at 1440 and 390 and never at 1024, which is
 * the width where column priority drops columns — a different set of cells,
 * different truncation, and so a different tree from either of the other two.
 * WA-65 changes what that width renders, and a width nobody scans is a width
 * whose heading order and contrast nobody has checked.
 */
for (const path of RECORD_PAGES) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.tablet, VIEWPORTS.phone]) {
    test(`records screen has no serious accessibility violations: ${path} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      // Asserted rather than assumed, as on the field scans: a scan that
      // silently ran at the wrong width would still pass everything below.
      expect(page.viewportSize()).toEqual(size);
      await page.goto(path);
      // Wait for the records. Scanning while the skeleton is up measures a
      // screen nobody is complaining about and races the one they are: this
      // scan was intermittent until it waited.
      await expect(
        page
          .locator(
            '[data-slot="data-table"], [data-slot="data-table-cards"], form[novalidate]',
          )
          .first(),
      ).toBeVisible();

      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/**
 * The desk dashboard is also read on a phone — a facility manager checking
 * overdue work from a corridor — and scanning it only at 1440 would leave the
 * reflow and small-target rules unscanned on the screen with the most on it.
 */
for (const path of ["/en/dashboard", "/fr/dashboard"]) {
  test(`desk dashboard has no serious accessibility violations at 390: ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    // Asserted, not assumed: a scan that silently ran at the project default
    // would pass every check below while testing the wrong width.
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);
    await page.goto(path);
    const results = await scan(page);
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}

/**
 * The asset page is the densest screen in the demonstration — eight sections,
 * chips, a description list and a form — so it is scanned at both widths in
 * both languages rather than only at the desk width. It reuses the tag declared
 * above, which the label scans already rely on being a real record.
 */
for (const locale of ["en", "fr"]) {
  for (const [name, size] of [
    ["desktop", VIEWPORTS.desktop],
    ["phone", VIEWPORTS.phone],
  ] as const) {
    test(`the asset page has no serious accessibility violations: ${locale} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      // Asserted, not assumed: a scan that silently ran at the project default
      // would pass every check below while testing the wrong width.
      expect(page.viewportSize()).toEqual(size);
      await page.goto(`/${locale}/assets/${assetTag}?tab=history`);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
        `${name} ${locale}`,
      ).toEqual([]);
    });
  }
}

/**
 * The edit dialog, open.
 *
 * The page scans above never see it: they photograph a screen with the form
 * closed, and a form is where labelling, focus order and focus trapping
 * actually go wrong. Scanned as an administrator, because no other role can
 * open it.
 */
test("the asset edit dialog has no serious accessibility violations", async ({
  context,
  page,
}) => {
  await useRole(context, "administrator");
  await page.goto(`/en/assets/${assetTag}`);
  await page.getByRole("button", { name: en.assetDetail.edit.action }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await scan(page, { opening: true });
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    blocking.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
});

/**
 * The dialog an administrator changes a person in, open, in both languages.
 *
 * Its three controls are a native select, a native select and a checkbox, each
 * labelled by the element that wraps it — the shape most likely to be wrong in
 * a way nothing else notices, because a wrapper that loses its text still
 * looks like a labelled control on screen. French as well as English: the two
 * catalogues are separate files and only one of them is read here at a time.
 */
for (const locale of ["en", "fr"] as const) {
  test(`the edit person dialog has no serious accessibility violations: ${locale}`, async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.goto(`/${locale}/users`);

    // The control the store draws, not the shell the server sent.
    const edit = page.locator('[data-slot="edit-person"]').first();
    await expect(edit).toBeVisible();
    await edit.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await scan(page, { opening: true });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
      `the edit person dialog in ${locale}`,
    ).toEqual([]);
  });
}

/**
 * The queue, in both languages at desktop and phone width.
 *
 * Phone is not the same page with less room: at 390 the table is cards, drawn
 * by a different branch, and a scan of the desktop table says nothing about it.
 */
for (const locale of ["en", "fr"]) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone] as const) {
    test(`the work-order queue has no serious accessibility violations: ${locale} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      expect(page.viewportSize()).toEqual(size);
      await page.goto(`/${locale}/work-orders`);
      const results = await scan(page, { opening: true });
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/**
 * One work order, and the number that resolves to nothing.
 *
 * Both, because they are different screens: the second is `RecordMissing`, and
 * a panel nobody scans is a panel whose heading order and contrast nobody has
 * checked.
 */
for (const locale of ["en", "fr"]) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone] as const) {
    test(`the work-order detail page has no serious accessibility violations: ${locale} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      expect(page.viewportSize()).toEqual(size);
      await page.goto(`/${locale}/work-orders/${DETAIL_NUMBER}`);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/*
 * The same screen as a technician, at the width they hold it.
 *
 * The scan above sets no role, so it reads the desk arrangement. WA-40 gives
 * the field view a different panel order and a taller action bar, and a layout
 * nobody scans is a layout whose heading order and contrast nobody has checked
 * — which is the whole argument the block above makes for scanning
 * `RecordMissing` separately.
 */
for (const locale of ["en", "fr"]) {
  test(`the field view of a work order has no serious accessibility violations: ${locale} at 390`, async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto(`/${locale}/work-orders/${DETAIL_NUMBER}`);
    const results = await scan(page);
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });

  test(`issuing a part has no serious accessibility violations: ${locale} at 390`, async ({
    context,
    page,
  }) => {
    /*
     * Scanned open. A dialog that is closed contributes nothing to the tree, so
     * a scan of the page behind it says nothing at all about the form inside —
     * and the form is the new surface WA-40 adds.
     */
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    /*
     * A live order, not `DETAIL_NUMBER`. That one is completed, and a completed
     * order offers no way to issue against it — correctly, because the movement
     * would be against a job nobody is doing. The first version of this test
     * used it and timed out waiting for a control the product is right not to
     * draw.
     */
    await page.goto(`/${locale}/work-orders/${LIVE_NUMBER}`);
    await page
      .getByRole("button", {
        name: (locale === "fr" ? fr : en).workOrderDetail.write.issuePart
          .action,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await scan(page, { opening: true });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}

test("a work-order number that resolves to nothing has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/en/work-orders/WO-1999-9999");
  const results = await scan(page);
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
});

/*
 * The scan with a control OPEN is below now. WA-49 did the fix this comment was
 * waiting for.
 *
 * What it was waiting for: every menu failed `aria-hidden-focus`, because
 * Radix's menu is modal by default and `MenuRootContentModal` calls
 * `hideOthers(content)` — so the skip link, the module rail and the trigger
 * itself were marked aria-hidden while staying focusable, and a keyboard
 * reached what a screen reader had been told was not there. Not this screen's
 * defect: the dashboard's site filter, shipped in WA-9, reproduced it exactly.
 *
 * The fix is `modal={false}` as the vendored default in `dropdown-menu.tsx`,
 * which selects the branch that never calls `hideOthers`, so there is no hidden
 * host for the rule to match. Not `aria-modal` on a menu, which would have
 * passed the rule by claiming to be something a filter is not — axe exempts
 * open modals, which is the only reason the dialog scan ever passed.
 *
 * The scans below open the control before scanning, which is the lesson as much
 * as the fix: three findings so far came only from a control being open, and a
 * screen scanned only as it loads is a screen scanned in one of its states.
 */

/**
 * Every screen that carries a menu, scanned with one open.
 *
 * The trigger is found by the vendored `data-slot` rather than by its label.
 * That is deliberate: the defect lives in the shared component, so *any* menu
 * on the screen demonstrates it, and anchoring on a message key would make this
 * fail when somebody renames a column — a failure about the wrong thing. It
 * also means the scan cannot be quietly defeated by a label that moved.
 */
const MENU_PAGES = [
  { path: "/en/dashboard", what: "the site filter" },
  { path: "/fr/dashboard", what: "the site filter" },
  { path: "/en/work-orders", what: "a queue facet" },
  { path: "/fr/work-orders", what: "a queue facet" },
  { path: "/en/assets", what: "a register facet" },
  { path: "/fr/assets", what: "a register facet" },
  { path: "/en/inventory", what: "a register facet" },
  { path: "/fr/inventory", what: "a register facet" },
] as const;

for (const { path, what } of MENU_PAGES) {
  test(`no serious violations with ${what} open: ${path}`, async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.goto(path);

    const trigger = page.locator('[data-slot="dropdown-menu-trigger"]').first();
    await expect(
      trigger,
      "this screen has no menu, so it is in the wrong list",
    ).toBeVisible();
    await trigger.click();

    /*
     * The floor, and it is the point of this whole section.
     *
     * A scan of a screen whose menu never opened is a scan of the screen at
     * rest — which every test above already does. It would pass, and it would
     * be measuring nothing. That is precisely how `aria-hidden-focus` survived
     * on every menu in the application from WA-9 until the first scan that
     * opened one.
     */
    await expect(
      page.locator('[role="menu"]'),
      "the menu never opened, so this is a scan of the screen at rest",
    ).toHaveCount(1);

    const results = await scan(page, { opening: true });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}

for (const path of FIELD_PAGES) {
  test(`field view has no serious accessibility violations: ${path}`, async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    // The field view exists for a phone. Scanning it at the project's 1440
    // default left reflow and small-viewport rules unscanned on the two pages
    // that most need them.
    await page.setViewportSize(VIEWPORTS.phone);
    // Asserted, not assumed: a scan that silently ran at the project default
    // would still pass every check below while testing the wrong width.
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);
    await page.goto(path);
    const results = await scan(page);
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}

/**
 * The parts register and one part.
 *
 * Both, and at both widths, because they are three different screens: a table
 * that becomes cards at 390, a record page, and — below — the stock number that
 * resolves to nothing, which is `RecordMissing` and is a panel nobody has
 * scanned on this route.
 */
for (const locale of ["en", "fr"]) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone] as const) {
    test(`the parts register has no serious accessibility violations: ${locale} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      expect(page.viewportSize()).toEqual(size);
      await page.goto(`/${locale}/inventory`);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });

    test(`the part detail page has no serious accessibility violations: ${locale} at ${size.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      expect(page.viewportSize()).toEqual(size);
      await page.goto(`/${locale}/inventory/${PART_NUMBER}`);
      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

test("a stock number that resolves to nothing has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/en/inventory/FLT-0000-NOPE");
  const results = await scan(page);
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
});

/**
 * Preventive maintenance, all three views.
 *
 * Three scans rather than one, because they are three different screens behind
 * one route: a table, a second table with different columns, and a list of
 * headings and cards that is not a table at all. A scan of whichever view
 * happens to load first would leave the other two unchecked while reading as
 * coverage of the module.
 */
for (const locale of ["en", "fr"] as const) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone] as const) {
    for (const view of ["visits", "month", "plans"] as const) {
      test(`preventive maintenance has no serious accessibility violations: ${view}, ${locale} at ${size.width}`, async ({
        context,
        page,
      }) => {
        await useRole(context, "maintenanceCoordinator");
        await page.setViewportSize(size);
        expect(page.viewportSize()).toEqual(size);
        await page.goto(declaredPath(PM_PAGES, locale));

        if (view !== "visits") {
          const label = (locale === "en" ? en : fr).maintenanceViews[view];
          await page
            .locator('[data-slot="maintenance-views"]')
            .getByRole("radio", { name: label })
            .click();
        }

        const results = await scan(page);
        const blocking = results.violations.filter(
          (violation) =>
            violation.impact === "serious" || violation.impact === "critical",
        );
        expect(
          blocking.map((violation) => `${violation.id}: ${violation.help}`),
        ).toEqual([]);
      });
    }
  }
}

/*
 * The library with a control **open**.
 *
 * Every scan above is of a page at rest, and a facet menu is the part of this
 * screen most likely to go wrong: it is a popover, it traps focus, and it is
 * drawn by markup that does not exist until somebody opens it. A closed
 * dropdown is a scan of a button.
 */
for (const locale of ["en", "fr"] as const) {
  test(`the document library has no serious violations with a facet open: ${locale}`, async ({
    page,
  }) => {
    /*
     * **This was a known red until WA-49 landed, and the skip is why it came
     * back on its own.**
     *
     * Opening any facet raised `aria-hidden-focus` — "ARIA hidden element must
     * not be focusable or contain focusable elements", serious, and part of
     * what the bid claims conformance on. It was measured rather than assumed
     * to be this ticket's: the **parts register**, which predates WA-21, raised
     * the identical violation when its category facet was opened, so the fault
     * was in the shared dropdown and reached four screens.
     *
     * It was written as `fixme` rather than deleted, and rather than as an
     * assertion expecting the violation: a skip says the screen *should* pass
     * and does not, and it becomes a failure the moment the component is fixed
     * and the line comes out — which is what a pinned-defect test can never do,
     * because a test that expects a defect goes red when the defect is fixed.
     *
     * WA-49 fixed it in `dropdown-menu.tsx` by making the vendored default
     * non-modal, this branch is the second of the two to land, and the line is
     * gone. What proves it is this test running un-skipped, not the reasoning
     * above.
     */
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/${locale}/documents`);
    await expect(page.getByRole("table")).toBeVisible();

    const kindLabel =
      locale === "en"
        ? en.documentsTable.columns.kind
        : fr.documentsTable.columns.kind;
    await page.getByRole("button", { name: kindLabel }).first().click();
    // A DropdownMenuCheckboxItem, so the role is menuitemcheckbox — not
    // option, which is a listbox and is what this waited for at first.
    await expect(page.getByRole("menuitemcheckbox").first()).toBeVisible();

    const results = await scan(page, { opening: true });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}

for (const { path, ready } of WA22_PAGES) {
  for (const size of [VIEWPORTS.desktop, VIEWPORTS.tablet, VIEWPORTS.phone]) {
    test(`WA-22 screen has no serious accessibility violations: ${path} at ${size.width}`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(size);
      await page.goto(path);
      await expect(page.locator(ready).first()).toBeVisible();

      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }
}

/**
 * The notification surfaces, and the bell is scanned **open**.
 *
 * A menu scanned only at rest is a menu scanned in the one state nobody uses
 * it in. That gap hid WA-49 on main from WA-9 onwards: every dropdown marked
 * the shell `aria-hidden` while leaving it focusable, serious under
 * `aria-hidden-focus`, and no scan had ever opened one. The bell is a popover
 * holding a list of links; it gets the same treatment.
 *
 * My notifications is a grid of twelve checkboxes, which is a shape that goes
 * wrong in a particular way — a checkbox in a grid with no name of its own is
 * announced as "checkbox" and nothing else — so it is scanned in both
 * languages and for a role that sees them disabled as well as one that does
 * not. Disabled is a different tree, not a greyer one.
 */
for (const locale of ["en", "fr"] as const) {
  test(`the bell has no serious accessibility violations when open: ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/${locale}/dashboard`);

    const label =
      locale === "en"
        ? en.shell.notifications.label
        : fr.shell.notifications.label;
    await page.getByRole("button", { name: new RegExp(label) }).click();
    // Opened, and proven opened: a scan of a closed menu is the scan that
    // missed WA-49, and it passes.
    await expect(
      page.locator('[data-slot="notification-settings-link"]'),
      "the bell never opened, so this is the scan that misses things",
    ).toBeVisible();

    const results = await scan(page, { opening: true });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });

  for (const [who, role] of [
    ["a person who may change them", "maintenanceCoordinator"],
    ["an auditor, who may not", "auditor"],
  ] as const) {
    test(`my notifications has no serious accessibility violations: ${locale}, ${who}`, async ({
      context,
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await useRole(context, role);
      await page.goto(declaredPath(NOTIFICATION_PAGES, locale));
      await expect(
        page.locator('[data-slot="my-notifications"]'),
      ).toBeVisible();

      const results = await scan(page);
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
      ).toEqual([]);
    });
  }

  test(`the email log has no serious accessibility violations: ${locale}`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "administrator");
    await page.goto(`/${locale}/settings`);
    /*
     * Scanned with rows in it rather than empty: a table's accessibility is
     * mostly about its cells, and an empty one has none.
     *
     * Zero is the right floor, and unusually the count is not derivable. The
     * seed ships `emailLog: []` and the runtime sweep fills it, so there is
     * no population to compare against — and there does not need to be: one
     * row exercises every header-to-cell association the scan is here to
     * check, so a small answer is not a wrong answer. What would be wrong is
     * no rows, which is what this catches.
     */
    await expect
      .poll(() => page.locator('[data-slot="email-log-row"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    const results = await scan(page);
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => `${violation.id}: ${violation.help}`),
    ).toEqual([]);
  });
}
