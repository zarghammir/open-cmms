import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

/**
 * Produces the screenshots used in the pull request and in the project
 * record. It is skipped unless WA_SCREENSHOTS=1, so continuous integration
 * never writes into the repository.
 */
const OUT = screenshotDir("WA-25");

test.describe("screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("desk view at three widths", async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.goto("/en/dashboard");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: en.modules.dashboard.title,
        }),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/desk-dashboard-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });

  test("assets and work orders", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/assets");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-assets-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/en/work-orders");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-work-orders-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("an action the role may not use", async ({ context, page }) => {
    await useRole(context, "auditor");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/work-orders");

    /*
     * The screen has to be alive before it can answer: an event delivered
     * before that reaches no handler at all, and nothing delivers it a second
     * time. Measured against a production build, the version before that wait
     * existed failed two runs in three and passed the third, which is what a
     * race looks like — not a tooltip that cannot be opened.
     *
     * This waited on `[data-slot="work-order-list"]` until WA-38 deleted that
     * component, and then on the queue's search box, which is this page's own
     * anchor. WA-52 replaced both: `hydrated` waits for something every page
     * draws only after the store has answered, so the wait no longer has to be
     * re-chosen each time a screen is rebuilt — which is twice, here, in three
     * days.
     */
    await hydrated(page);

    // Open the explanation the way a person does, with a pointer that actually
    // arrives on the trigger. Hover is also slower than focus(), because
    // Playwright waits for the element to be actionable first — which is
    // precisely why it is not the fix on its own: winning a race is not the
    // same as removing one. The wait above removes it; this is how a person
    // opens the thing.
    await page.locator('[data-slot="capability-action"]').hover();
    await expect(
      page.getByText(
        en.permissions.actionDenied.replace("{role}", en.roles.auditor.name),
      ),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-action-denied-auditor-1440.png`,
      animations: "disabled",
    });

    await page.goto("/en/users");
    await expect(page.getByText(en.permissions.deniedTitle)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-permission-denied-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("field view on a phone and a tablet", async ({ context, page }) => {
    await useRole(context, "technician");

    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/my-work");
    await hydrated(page);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.myWork.title }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/field-my-work-390.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: en.shell.toggleNavigation }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("link", { name: en.modules.myWork.title }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/field-navigation-390.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");

    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/en/my-work");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/field-my-work-1024.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("French", async ({ context, page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/fr/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: fr.modules.dashboard.title }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-desk-dashboard-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/fr/settings");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-desk-settings-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/fr/my-work");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-field-my-work-390.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("the session menu and keyboard focus", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/dashboard");
    await hydrated(page);
    await page.getByRole("button", { name: en.shell.user.menuLabel }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-session-menu-1440.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");

    // First tab stop, then the first module link: both must show a focus ring.
    await page.keyboard.press("Tab");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/keyboard-skip-link-1440.png`,
      animations: "disabled",
    });
    for (let index = 0; index < 3; index += 1) {
      await page.keyboard.press("Tab");
    }
    await settled(page);
    await page.screenshot({
      path: `${OUT}/keyboard-focus-rail-1440.png`,
      animations: "disabled",
    });
  });
});
