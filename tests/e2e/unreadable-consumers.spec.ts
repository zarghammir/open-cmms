import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { failTheNextRead, useRole } from "../fixtures/shell";

/**
 * A read that failed is not a part that does not exist.
 *
 * WA-58 gave the store a third state, `unreadable`. These two panels were
 * written when there were two and gate on `status === "unknown"` — which is
 * still valid TypeScript against a three-member union, so the new state falls
 * straight through and both render their full working panel over a store that
 * holds nothing.
 *
 * What that costs a person is worse than a blank screen. The scan panel offers
 * a camera, and an unmatched code there means "we did not recognise this — the
 * same answer a code we do not hold produces". So a technician standing at a
 * machine, holding a label, is told **the part is not in the system** when the
 * truth is that the records could not be read. A wrong answer, presented as an
 * answer.
 *
 * Both screens are asserted in both languages: the panel that must not appear
 * is built out of translated strings, and a locale that skipped the gate would
 * be invisible in an English-only run.
 *
 * The verification sheet renders the scan panel *inside* itself, so the camera
 * alone cannot tell the two gates apart — fixing the inner panel would hide a
 * missing fix in the outer one. Each screen is therefore asserted on something
 * only its own branch draws.
 */

type Prefix = "en" | "fr";

interface Screen {
  name: string;
  path: string;
  /** Drawn only by this screen's own working branch, in each language. */
  own: (page: Page, prefix: Prefix) => Locator;
}

const SCREENS: Screen[] = [
  {
    name: "the scan panel",
    path: "my-work/scan",
    // The camera is the scan panel's own: nothing else draws this heading.
    own: (page, prefix) =>
      page.getByRole("heading", {
        name: prefix === "en" ? en.scan.cameraTitle : fr.scan.cameraTitle,
      }),
  },
  {
    name: "the verification sheet",
    path: "inventory/verify",
    // The count sheet is the sheet's own, below the scan panel it embeds.
    own: (page, prefix) =>
      page.getByRole("heading", {
        name: prefix === "en" ? en.verify.sheetTitle : fr.verify.sheetTitle,
      }),
  },
];

const LOCALES: Prefix[] = ["en", "fr"];

/**
 * Proof the failure reached the application, before anything is said about
 * what is missing from the screen.
 *
 * Without it every assertion below is satisfied by a page that never loaded:
 * no camera, no sheet, no panel — and no test either. `DemoBoot` renders the
 * store's own status into the layout, so this is the store saying the read
 * failed rather than the fixture claiming it made it fail.
 */
async function readFailed(page: Page) {
  await expect(
    page.locator('[data-demo-status="unreadable"]'),
    "the forced failure never reached the store: nothing below is being tested",
  ).toBeAttached({ timeout: 15_000 });
}

for (const screen of SCREENS) {
  for (const prefix of LOCALES) {
    test(`${screen.name} refuses by name rather than working when the read failed (${prefix})`, async ({
      context,
      page,
    }) => {
      await useRole(context, "technician");
      await failTheNextRead(page);
      await page.goto(`/${prefix}/${screen.path}`);

      await readFailed(page);

      /*
       * What the person gets instead, and this line is WA-66 landing.
       *
       * Until this branch these four tests asserted a **skeleton** — the
       * waiting state these screens showed before the third status existed,
       * which the comment here called honest only "until WA-66". It was the
       * better of two bad answers and it is not one any more: waiting for ever
       * is what a frozen application looks like. The refusal says what
       * happened, that nothing was lost, and what to do.
       *
       * Changed rather than deleted, because these four still carry something
       * `unreadable-refusal.spec.ts` does not: each screen is asserted on an
       * element only *its own* branch draws, which is what tells the sheet's
       * gate apart from the scan panel it embeds.
       */
      await expect(
        page.locator('[data-slot="records-unreadable"]'),
        "the screen neither works nor says why",
      ).toBeVisible();
      /*
       * **Visible skeletons, because that is what the sentence below claims.**
       *
       * This counted every `[data-slot="skeleton"]` node in the document. On
       * WA-113's build it caught four of them still attached at the instant
       * the count runs, measuring **0 by 0 at y 0** — `LoadingState`'s markup
       * inside a subtree nobody can see — while the refusal panel was visible
       * and the store's status was `unreadable`. The screen was right and the
       * assertion was reading the DOM rather than the screen.
       *
       * Measured either way: main's toggle, four runs, five green; WA-113's
       * toggle, four runs, red each time; WA-113's toggle with this line,
       * three runs, five green. Why a CSS change to a shared component shifts
       * when that hidden subtree detaches is **not known**, and is a ticket of
       * its own rather than a sentence here.
       */
      expect(
        await page.locator('[data-slot="skeleton"]:visible').count(),
        "the screen is still waiting rather than refusing: a skeleton with no end",
      ).toBe(0);

      await expect(
        screen.own(page, prefix),
        `${screen.name} rendered its working panel over a store that holds nothing`,
      ).toHaveCount(0);

      // The camera and the upload are the two ways into a scan, and neither
      // screen may offer one. On the sheet this also covers the panel it
      // embeds; its own gate is the assertion above.
      await expect(
        page.getByRole("button", {
          name: prefix === "en" ? en.scan.startCamera : fr.scan.startCamera,
        }),
      ).toHaveCount(0);
      await expect(
        page.locator('input[type="file"]'),
        "the upload is the second way to scan, and the one a desktop uses",
      ).toHaveCount(0);
    });
  }
}

/**
 * The control that makes the four tests above mean something.
 *
 * Every assertion there is an absence, and an absence agrees with a typo in a
 * message key, a renamed role, or a route that 404s. Same screens, same
 * locators, no forced failure: everything is there.
 */
test("both screens work normally when the records can be read", async ({
  context,
  page,
}) => {
  await useRole(context, "technician");

  for (const screen of SCREENS) {
    await page.goto(`/en/${screen.path}`);
    await expect(
      page.locator('[data-demo-status="ready"]'),
      `${screen.name} never became ready`,
    ).toBeAttached({ timeout: 15_000 });

    await expect(
      screen.own(page, "en"),
      `${screen.name}: the locator finds nothing even with a healthy store`,
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: en.scan.startCamera }),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  }
});
