import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  PINNED_DAY,
  pinTheDay,
  screenshotDir,
  settled,
} from "../fixtures/screenshots";
import { VIEWPORTS, hydrated, useRole } from "../fixtures/shell";

/**
 * The pictures for WA-22's second half. Skipped unless WA_SCREENSHOTS=1.
 *
 * Four, named here before they were taken, so the set is a claim that can be
 * checked rather than whatever the run happened to produce.
 *
 * They share `screenshotDir("WA-22")` with the first half's spec, which writes
 * `en-facilities-*` and the report shots. Filenames here are prefixed to keep
 * the two sets apart in one folder — the helper only builds a path, it does not
 * clear the directory, so nothing of theirs is at risk.
 *
 * Every shot disables animations, which fast-forwards CSS transitions to their
 * end state. WA-21 learned that the expensive way: a toast asserted in the DOM
 * and absent from the picture, because the shutter caught it mid-slide.
 */

const OUT = screenshotDir("WA-22");

/** The pinned day, so the same screen photographed twice gives the same bytes. */
void PINNED_DAY;

async function users(page: Page, locale: "en" | "fr") {
  await pinTheDay(page);
  await page.goto(`/${locale}/users`);
  await hydrated(page);

  // Wait for the records rather than photographing a skeleton — and for the
  // role table too, which draws from a different source and would otherwise be
  // half-painted in the picture.
  await expect(
    page
      .locator('[data-slot="data-table"], [data-slot="data-table-cards"]')
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: (locale === "fr" ? fr : en).roleTable.title,
    }),
  ).toBeVisible();
  await settled(page);
}

test.describe("WA-22 administration screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("who works here, at desk width", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await users(page, "en");
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `${OUT}/en-users-1440.png`,
    });
  });

  test("what each role may do, in French", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await users(page, "fr");
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `${OUT}/fr-users-1440.png`,
    });
  });

  /*
   * The phone shot is the role table's other layout, not a narrower version of
   * the one above: thirteen rows against six columns becomes one block per
   * role. A picture of the grid squeezed would be a picture of a screen that
   * does not exist.
   */
  test("the role table as one block per role, on a phone", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.phone);
    await users(page, "en");
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: `${OUT}/en-users-390.png`,
    });
  });

  /*
   * The Invite control with its reason showing, which is the one state a
   * reader cannot infer from the others: a disabled button is a picture of
   * nothing happening unless the explanation is in the frame.
   */
  test("Invite, disabled, saying why", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await users(page, "en");

    await page.locator('[data-slot="phase-action"]').focus();
    await expect(page.getByText(en.users.invite.unavailable)).toBeVisible();
    await settled(page);

    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-users-invite-reason.png`,
    });
  });

  test("the organisation, read-only, in Settings", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await pinTheDay(page);
    await page.goto("/en/settings");
    await hydrated(page);
    await expect(
      page.getByRole("heading", { name: en.organizationProfile.title }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="organization-site"]')).toHaveCount(
      5,
    );
    await settled(page);

    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-settings-organization.png`,
    });
  });
});
