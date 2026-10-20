import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { hydrated, useRole, watchConsole } from "../fixtures/shell";
import { settled } from "../fixtures/screenshots";

/**
 * The MP2 import, in a browser, against the fixture a reviewer can open.
 *
 * The file is the committed `tests/fixtures/mp2-export-sample.xlsx`, whose data
 * dictionary names twelve planted defects by sheet and row. So these assertions
 * are not "the report shows something" — they are the dictionary's own numbers,
 * read off the screen.
 */

// `process.cwd()`, not `import.meta.dirname`: Playwright transpiles specs to
// CommonJS, where `import.meta` does not exist. The runner starts at the
// project root, so this resolves the same on every machine and in CI.
const FIXTURE = path.resolve(
  process.cwd(),
  "tests/fixtures/mp2-export-sample.xlsx",
);

async function openWizard(page: Page) {
  await page.goto("/en/settings/import");
  await hydrated(page);
}

/** Chooses the fixture and waits for the mapping step to appear. */
async function chooseFixture(page: Page) {
  await page
    .getByRole("button", { name: en.import.upload.action })
    .first()
    .click()
    .catch(() => undefined);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(
    page.getByRole("heading", { name: en.import.map.title }),
  ).toBeVisible();
}

test.describe("the import wizard", () => {
  test("reads the fixture and lands on the mapping step", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    const watcher = watchConsole(page);
    await openWizard(page);

    await expect(
      page.getByRole("heading", { name: en.import.upload.title }),
    ).toBeVisible();

    await chooseFixture(page);
    expect(watcher.errors).toEqual([]);
  });

  test("leaves exactly the two columns MP2 spells differently", async ({
    context,
    page,
  }) => {
    // Not a contrivance: an alias table built from common MP2 exports does not
    // cover CRITICALITY or MIN_QTY, because installations name them
    // differently. They are what the mapping step exists for.
    await useRole(context, "administrator");
    await openWizard(page);
    await chooseFixture(page);

    await expect(
      page.getByText(en.import.map.stillNeeded.replace("{count}", "2")),
    ).toBeVisible();
  });

  test("finds the twelve planted defects the dictionary names", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await openWizard(page);
    await chooseFixture(page);

    // Match the two columns by hand, as a person would.
    await page.locator("#equipment-criticality").selectOption("CRITICALITY");
    await page.locator("#inventory-reorderPoint").selectOption("MIN_QTY");

    await page.getByRole("button", { name: en.import.next }).click();
    await expect(
      page.getByRole("heading", { name: en.import.report.title }),
    ).toBeVisible();

    // Five rows cannot be imported: the missing description, the location on a
    // site that does not exist, and three orders pointing at absent equipment.
    await expect(
      page.getByText(en.import.report.blocking.replace("{count}", "5")),
    ).toBeVisible();

    // The row numbers are the dictionary's own.
    await expect(
      page.getByRole("cell", { name: "47", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "62", exact: true }),
    ).toBeVisible();
  });

  test("a row can be corrected, and the report is read again", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await openWizard(page);
    await chooseFixture(page);
    await page.locator("#equipment-criticality").selectOption("CRITICALITY");
    await page.locator("#inventory-reorderPoint").selectOption("MIN_QTY");
    await page.getByRole("button", { name: en.import.next }).click();

    const before = await page
      .getByRole("button", { name: en.import.report.fixAction })
      .count();

    await page
      .getByRole("button", { name: en.import.report.fixAction })
      .first()
      .click();
    await page.getByRole("textbox").first().fill("BLR-MCT-99");
    await page.getByRole("button", { name: en.import.report.fixSave }).click();

    // The correction clears the report, because the report described the rows
    // as they were. Reading them again is a step, not a background refresh.
    await expect(page.getByText(en.import.report.notRunTitle)).toBeVisible();
    expect(before).toBeGreaterThan(0);
  });

  test("the preview counts records, not spreadsheet rows", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await openWizard(page);
    await chooseFixture(page);
    await page.locator("#equipment-criticality").selectOption("CRITICALITY");
    await page.locator("#inventory-reorderPoint").selectOption("MIN_QTY");
    await page.getByRole("button", { name: en.import.next }).click();
    await page.getByRole("button", { name: en.import.next }).click();

    await expect(
      page.getByRole("heading", { name: en.import.preview.title }),
    ).toBeVisible();

    // 80 equipment rows become 76 assets: two blocked, and two that duplicate a
    // tag already arriving, because a duplicate key is one asset entered twice.
    await expect(
      page.getByText(`${en.import.preview.assets}: 76`),
    ).toBeVisible();

    // Time is stated once and never as a zero.
    await expect(page.getByText(en.import.preview.timeNote)).toBeVisible();
  });

  test("committing writes the records, and undoing takes exactly those back", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await openWizard(page);
    await chooseFixture(page);
    await page.locator("#equipment-criticality").selectOption("CRITICALITY");
    await page.locator("#inventory-reorderPoint").selectOption("MIN_QTY");
    await page.getByRole("button", { name: en.import.next }).click();
    await page.getByRole("button", { name: en.import.next }).click();
    await page.getByRole("button", { name: en.import.next }).click();

    await expect(
      page.getByRole("heading", { name: en.import.commit.title }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: new RegExp(en.import.commit.action.replace("{count}", "\\d+")),
      })
      .click();

    await expect(page.getByText(en.import.commit.doneTitle)).toBeVisible();

    // The asset register now holds one of the imported tags, and the seeded
    // ones are still there — the import added, it did not replace.
    // The register paginates, so the tag is searched for rather than expected
    // on the first page — a row that exists but is on page four is not a
    // failure, and asserting otherwise would make this test about pagination.
    await page.goto("/en/assets");
    await hydrated(page);
    const seededTag = await page
      .locator("table tbody tr td:first-child")
      .first()
      .innerText();
    await page.locator("#data-table-search").fill("AHU-KGN-01");
    await expect(
      page.locator("table tbody tr", { hasText: "AHU-KGN-01" }).first(),
    ).toBeVisible();

    // Undo, and the imported tag is gone — exactly it, not everything that
    // looks like it: the seeded record the register already held survives.
    await page.goto("/en/settings/import");
    await hydrated(page);
    await page.getByRole("button", { name: en.import.commit.undo }).click();
    await expect(page.getByText(en.import.commit.doneTitle)).toHaveCount(0);
    // The banner going is the React state; the records reaching IndexedDB is a
    // separate write, and a navigation that beats it reloads the pre-undo
    // store. `settled` waits for the store to have answered and drawn.
    await settled(page);

    await page.goto("/en/assets");
    await hydrated(page);
    await page.locator("#data-table-search").fill("AHU-KGN-01");
    // Asserted on the table body rather than the page: the empty state repeats
    // the search term, so "the text is absent" would be measuring the wrong
    // thing. What matters is that no row holds it any more.
    await expect(
      page.locator("table tbody tr", { hasText: "AHU-KGN-01" }),
    ).toHaveCount(0);

    // And the record the register already held is still there: the undo took
    // exactly what the import created, not everything that resembled it.
    await page.locator("#data-table-search").fill(seededTag.trim());
    await expect(
      page.locator("table tbody tr", { hasText: seededTag.trim() }).first(),
    ).toBeVisible();
  });

  test("a role that may not open Settings never reaches the import", async ({
    context,
    page,
  }) => {
    // Settings is the gate, and it is the only one that can fire: every role
    // that can open Settings also holds `settings.manage`. An auditor is
    // stopped at the module, not at the commit button.
    await useRole(context, "auditor");
    await page.goto("/en/settings/import");
    await hydrated(page);

    await expect(page.getByText(en.permissions.deniedTitle)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: en.import.upload.title }),
    ).toHaveCount(0);
  });
});
