import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { ROLES } from "@/domain/constants/roles";
import { expectTableFits, measureTableFit } from "../fixtures/table-fit";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its own
// asserts against a fresh response, so the worker is removed first: a cached
// page would let a test quietly pass against a build no longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * Users and Roles, booted.
 *
 * Three questions the unit tests cannot answer, because each needs a route, a
 * cookie or a rendered shell: does the screen draw at every width without
 * scrolling sideways, does the role gate actually gate, and is the Invite
 * control disabled with its reason **reachable** rather than merely disabled.
 *
 * The last one is the reason this file exists at all. A disabled button cannot
 * take focus, so its explanation is reachable only through the focusable
 * wrapper around it — and nothing but a keyboard in a browser can prove that.
 */

for (const locale of ["en", "fr"] as const) {
  for (const [label, size] of Object.entries(VIEWPORTS)) {
    const path = `/${locale}/users`;

    test(`${path} is clean at ${label} (${size.width})`, async ({
      context,
      page,
    }) => {
      const watcher = watchConsole(page);
      await page.setViewportSize(size);
      // Asserted rather than assumed: a case that silently ran at the project
      // default would satisfy everything below while measuring another width.
      expect(page.viewportSize()).toEqual(size);
      await useRole(context, "administrator");
      await page.goto(path);
      await hydrated(page);

      const messages = locale === "fr" ? fr : en;

      /*
       * The floor. "Nothing overflows" and "the console is clean" are both
       * satisfied perfectly by a screen that drew nothing, and at 390 the
       * table becomes cards — so either shape counts, and one of them must be
       * there before the width means anything.
       */
      await expect(
        page
          .locator('[data-slot="data-table"], [data-slot="data-table-cards"]')
          .first(),
      ).toBeVisible();

      // The role table is the other half of the screen and draws from a
      // different source, so its absence would not show in the table above.
      await expect(
        page.getByRole("heading", { name: messages.roleTable.title }),
      ).toBeVisible();

      expect(
        await hasHorizontalOverflow(page),
        `${path} scrolls sideways at ${size.width}`,
      ).toBe(false);

      /*
       * And the box that CLIPS, which the line above cannot see.
       *
       * The register sits in an `overflow-x-auto` wrapper, so a column wide
       * enough to push the table past that wrapper produces no page-level
       * overflow at all — every document measurement reads identically on both
       * sides of the defect. It happened here: the trades column ran the table
       * 189 px past its wrapper in English and 225 in French, and what a
       * person saw was words cut mid-letter at the table's edge. The picture
       * found it; no number did.
       *
       * `expectTableFits` is the house instrument for this and it carries its
       * own floor — it proves the container actually squeezed before believing
       * any width it reports. My first attempt at this was hand-rolled, and it
       * walked up from the wrong element, found no clipping box and returned
       * null, which a `!= null` guard then turned into a pass. It went green
       * against a table that was still 26 px over in English and 96 in French.
       *
       * Skipped at 390 on purpose: below `md` the register is cards and there
       * is no table to fit.
       */
      if (size.width >= VIEWPORTS.tablet.width) {
        expectTableFits(
          await measureTableFit(page),
          `${path} at ${size.width}`,
        );
      }

      expect(watcher.errors, `${path} logged to the console`).toEqual([]);
    });
  }
}

/**
 * The gate, from both sides.
 *
 * `/users` is the administrator's alone. A test that only proved the
 * administrator gets in would pass just as happily on a screen with no gate at
 * all, so every other role is asked as well — and what they must meet is the
 * permission panel, not a blank page and not a redirect.
 *
 * One test per role rather than a loop inside one test, for two reasons. A red
 * then names the role that broke instead of the first one the loop reached —
 * and `useRole` reads to the React lint rules as a hook, which they refuse to
 * see called in a loop. The rule is about React components and this is a
 * Playwright fixture, but the shape it objects to is the one that hides which
 * case failed, so the restructure is worth having on its own terms.
 */
const DENIED = ROLES.filter((role) => role !== "administrator");
test("the administrator opens Users and Roles", async ({ context, page }) => {
  await useRole(context, "administrator");
  await page.goto("/en/users");
  await hydrated(page);
  await expect(
    page.getByRole("heading", { name: en.roleTable.title }),
    "the administrator sees the screen",
  ).toBeVisible();
});

/*
 * The floor for the loop below. If `ROLES` were ever filtered or renamed to
 * nothing, the generated tests would silently become none — and a suite that
 * runs no cases agrees with itself perfectly.
 */
test("there are five roles that must not open it", () => {
  expect(DENIED).toHaveLength(5);
  expect(DENIED).not.toContain("administrator");
});

for (const role of DENIED) {
  test(`${role} is refused Users and Roles, with the reason`, async ({
    context,
    page,
  }) => {
    await useRole(context, role);
    await page.goto("/en/users");
    await hydrated(page);

    await expect(
      page.getByText(en.permissions.deniedTitle),
      `${role} is told why, rather than shown nothing`,
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: en.roleTable.title }),
      `${role} cannot read the role table`,
    ).toBeHidden();
  });
}

/**
 * Invite: present, disabled, and its reason reachable from the keyboard.
 *
 * The control is unavailable because the feature arrives in Phase 2, not
 * because of the role — every viewer of this screen holds every capability.
 * What matters here is that somebody who cannot use a mouse can still find out
 * why: the disabled button is wrapped in a focusable span for exactly that,
 * and the wrapper is the only thing that can be focused.
 */
test("the Invite control says why it is unavailable, to the keyboard", async ({
  context,
  page,
}) => {
  await useRole(context, "administrator");
  await page.goto("/en/users");
  await hydrated(page);

  const invite = page.getByRole("button", { name: en.users.invite.label });
  await expect(invite).toBeVisible();
  await expect(invite, "present and disabled, never hidden").toBeDisabled();

  // Focus the wrapper the way a keyboard reaches it, rather than calling
  // focus() on the button — which is the thing that cannot take focus, and
  // would prove nothing about the path a person actually has.
  await page.locator('[data-slot="phase-action"]').focus();

  await expect(
    page.getByText(en.users.invite.unavailable),
    "the reason appears on focus",
  ).toBeVisible();
});
