import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";
import { VIEWPORTS, hydrated, useRole } from "../fixtures/shell";

/**
 * The pictures for WA-124. Skipped unless WA_SCREENSHOTS=1.
 *
 * Four, named before they were taken: the register with the control an
 * administrator uses, the form itself in both languages, the same control on a
 * phone — where the register is cards and a column priority says nothing — and
 * the trail afterwards, which is the half of this change that has no control
 * at all. A screenshot of a register looks identical on both sides of this
 * ticket unless the frame includes the thing that was added.
 */

const OUT = screenshotDir("WA-124");

async function usersScreen(page: Page, locale: "en" | "fr") {
  await pinTheDay(page);
  await page.goto(`/${locale}/users`);
  await hydrated(page);
  // The control the store draws, which is also the subject of the picture.
  await expect(page.locator('[data-slot="edit-person"]').first()).toBeVisible();
  await settled(page);
}

/**
 * Somebody other than the person holding the demonstration.
 *
 * The first row of the register is the administrator, who is also the signed-in
 * viewer — so a picture of that row being edited shows an administrator
 * changing their own role, which is exactly the confusion the seam note on the
 * pull request exists to prevent. A reader would take it as the viewer's own
 * capabilities changing, which is the one thing this does not do.
 *
 * Chosen by reading the register rather than by naming a person, so it stays
 * right as the demonstration data changes.
 */
async function openTheForm(page: Page, locale: "en" | "fr") {
  const strings = locale === "fr" ? fr : en;
  const row = page
    .locator('[data-slot="data-table"] tbody tr')
    .filter({ hasNotText: strings.roles.administrator.name })
    .first();
  await row.locator('[data-slot="edit-person"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('[data-slot="person-role"]')).toBeVisible();
  await settled(page);
}

test.describe("WA-124 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the register an administrator manages people from", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await usersScreen(page, "en");
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-people-register-1440.png`,
    });
  });

  for (const locale of ["en", "fr"] as const) {
    test(`the form, in ${locale}`, async ({ context, page }) => {
      await useRole(context, "administrator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await usersScreen(page, locale);
      await openTheForm(page, locale);
      await page.getByRole("dialog").screenshot({
        animations: "disabled",
        path: `${OUT}/${locale}-edit-person.png`,
      });
    });
  }

  test("the same control on a phone, where the register is cards", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.phone);
    await usersScreen(page, "en");
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-people-cards-390.png`,
    });
  });

  test("the trail, after a role and a site have changed", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await usersScreen(page, "en");
    await openTheForm(page, "en");

    const dialog = page.getByRole("dialog");
    const roleSelect = dialog.locator('[data-slot="person-role"]');
    const siteSelect = dialog.locator('[data-slot="person-site"]');

    // A different answer, taken from what the form itself offers, so the
    // picture is of whatever the demonstration data holds that day.
    const otherRole = await roleSelect
      .locator("option")
      .evaluateAll(
        (nodes, current) =>
          (nodes as HTMLOptionElement[]).find((node) => node.value !== current)
            ?.value ?? "",
        await roleSelect.inputValue(),
      );
    const otherSite = await siteSelect
      .locator("option")
      .evaluateAll(
        (nodes, current) =>
          (nodes as HTMLOptionElement[]).find((node) => node.value !== current)
            ?.value ?? "",
        await siteSelect.inputValue(),
      );
    await roleSelect.selectOption(otherRole);
    await siteSelect.selectOption(otherSite);
    await dialog.getByRole("button", { name: en.managePeople.save }).click();

    // The dialog closing is the durability signal: photographing the trail
    // before the write landed would picture a dashboard that never saw it.
    await expect(dialog).toBeHidden();

    await page.goto("/en/dashboard");
    await hydrated(page);
    const feed = page.locator('[data-slot="activity-feed"]');
    await expect(feed).toBeVisible();
    await settled(page);

    await feed.screenshot({
      animations: "disabled",
      path: `${OUT}/en-trail-after-managing.png`,
    });
  });

  test("the French register", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await usersScreen(page, "fr");
    await expect(
      page.getByRole("heading", { name: fr.roleTable.title }),
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/fr-people-register-1440.png`,
    });
  });
});
