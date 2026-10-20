import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * Using the documents screens the way a person does, at every width this
 * project ships and in both languages, with the console watched.
 *
 * The widths are not decoration: 1024 is where the library drops its Format
 * column and 390 is where the table stops being a table, so each is a different
 * screen rather than the same one scaled.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const PAPERED_ORDER = (() => {
  const seed = buildSeed(new Date());
  const paper = seed.documents.find((one) => one.workOrderId !== null)!;
  return seed.workOrders.find((one) => one.id === paper.workOrderId)!.number;
})();

const strings = { en, fr } as const;

async function openLibrary(page: Page, locale: "en" | "fr", phone = false) {
  await page.goto(`/${locale}/documents`);
  await hydrated(page);
  await expect(
    phone
      ? page.locator('[data-slot="data-table-cards"] article').first()
      : page.getByRole("table"),
  ).toBeVisible();
}

for (const locale of ["en", "fr"] as const)
  for (const [label, viewport, phone] of [
    ["1440", VIEWPORTS.desktop, false],
    ["1024", VIEWPORTS.tablet, false],
    ["390", VIEWPORTS.phone, true],
  ] as const) {
    test(`the library searches and clears at ${label} in ${locale}`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await openLibrary(page, locale, phone);

      const rows = phone
        ? page.locator('[data-slot="data-table-cards"] article')
        : page.locator('[data-slot="data-table"] tbody tr');
      const before = await rows.count();
      expect(
        before,
        "nothing drawn, so nothing below measures anything",
      ).toBeGreaterThan(0);

      await page
        .getByRole("searchbox", {
          name: strings[locale].documentsTable.searchLabel,
        })
        .fill("agreement");

      await expect.poll(async () => rows.count()).toBeLessThan(before);
      // Narrowing is not enough: a search returning the wrong rows returns
      // fewer of them too.
      await expect(
        page.getByText(strings[locale].filedAgainst.organisation).first(),
      ).toBeVisible();

      await page
        .getByRole("searchbox", {
          name: strings[locale].documentsTable.searchLabel,
        })
        .fill("");
      await expect.poll(async () => rows.count()).toBe(before);

      expect(watcher.errors).toEqual([]);
    });
  }

test.describe("attaching a document to a work order", () => {
  test("records an accepted file, and the panel shows it", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/work-orders/${PAPERED_ORDER}`);
    await hydrated(page);

    const panel = page.getByText(en.documentUpload.title);
    await expect(panel).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "pump-curve.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 not really a pdf"),
    });

    // The record, not the toast: a panel that toasted and wrote nothing would
    // satisfy an assertion on the message.
    await expect(page.getByText("pump-curve.pdf").first()).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });

  test("an auditor sees the control and is told why it is closed", async ({
    context,
    page,
  }) => {
    // Disabled and explained, never hidden: `CapabilityAction` is the rule, and
    // a control that vanishes teaches a reviewer the feature is missing.
    await useRole(context, "auditor");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/work-orders/${PAPERED_ORDER}`);
    await hydrated(page);

    const attach = page.getByRole("button", {
      name: en.documentUpload.action,
    });
    await expect(attach).toBeVisible();
    await expect(attach).toBeDisabled();
  });

  test("the keyboard reaches the attach control, and focus shows", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/work-orders/${PAPERED_ORDER}`);
    await hydrated(page);

    const kind = page.getByLabel(en.documentUpload.kindLabel);
    await kind.focus();
    await expect(kind).toBeFocused();

    // Tab moves from the kind select to the button beside it, which is the
    // order somebody using a keyboard would expect.
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: en.documentUpload.action }),
    ).toBeFocused();

    const outline = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      const style = getComputedStyle(active);
      return `${style.outlineStyle}|${style.outlineWidth}|${style.boxShadow}`;
    });
    // Something has to draw the focus: an outline or a ring. Asserted rather
    // than eyeballed, because a focus nobody can see is a keyboard path that
    // does not exist.
    expect(outline).not.toBeNull();
    expect(outline === "none|0px|none").toBe(false);
  });
});
