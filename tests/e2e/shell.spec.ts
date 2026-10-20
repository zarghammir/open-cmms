import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const DESK_MODULES = [
  ["/dashboard", en.modules.dashboard.title],
  ["/facilities", en.modules.facilities.title],
  ["/assets", en.modules.assets.title],
  ["/work-orders", en.modules.workOrders.title],
  ["/preventive-maintenance", en.modules.preventiveMaintenance.title],
  ["/inspections", en.modules.inspections.title],
  ["/inventory", en.modules.inventory.title],
  ["/documents", en.modules.documents.title],
  ["/reports", en.modules.reports.title],
  ["/users", en.modules.users.title],
  ["/settings", en.modules.settings.title],
] as const;

test.describe("application shell", () => {
  test("the bare locale root lands on the role's home", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.dashboard.title }),
    ).toBeVisible();
  });

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`renders the desk shell at ${viewport.width}px (${name}) without overflow or console errors`, async ({
      page,
    }) => {
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await page.goto("/en/dashboard");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: en.modules.dashboard.title,
        }),
      ).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(watcher.errors).toEqual([]);
    });
  }

  test("the module rail lists every module an administrator may open", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    const nav = page.getByRole("navigation", {
      name: en.shell.primaryNavigation,
    });

    for (const [, title] of DESK_MODULES) {
      await expect(nav.getByRole("link", { name: title })).toBeVisible();
    }
    await expect(
      nav.getByRole("link", { name: en.modules.myWork.title }),
    ).toHaveCount(0);
  });

  for (const [href, title] of DESK_MODULES) {
    test(`${href} opens with a page header and content`, async ({ page }) => {
      const watcher = watchConsole(page);
      await page.goto(`/en${href}`);

      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      expect(watcher.errors).toEqual([]);
    });
  }

  test("switching language changes every visible label and the document language", async ({
    page,
  }) => {
    await page.goto("/en/work-orders");
    await hydrated(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: en.modules.workOrders.title,
      }),
    ).toBeVisible();

    await page
      .getByRole("radiogroup", { name: en.shell.language.label })
      .getByRole("radio", {
        name: en.shell.language.switchTo.replace(
          "{language}",
          en.shell.language.options["fr-CA"],
        ),
      })
      .click();

    await expect(page).toHaveURL(/\/fr\/work-orders$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fr.modules.workOrders.title,
      }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
    await expect(
      page.getByRole("navigation", { name: fr.shell.primaryNavigation }),
    ).toBeVisible();
  });

  test("the chosen language survives a visit to the bare root", async ({
    page,
  }) => {
    await page.goto("/fr/dashboard");
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr\/dashboard$/);
  });

  test("switching role to technician opens the field view and drops desk-only modules", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    await hydrated(page);

    await page.getByRole("button", { name: en.shell.user.menuLabel }).click();
    await page
      .getByRole("menuitemradio", {
        name: new RegExp(en.roles.technician.name),
      })
      .click();

    await expect(page).toHaveURL(/\/en\/my-work$/);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.myWork.title }),
    ).toBeVisible();
    // The field view has no persistent rail; navigation is behind a button.
    await expect(
      page.getByRole("button", { name: en.shell.toggleNavigation }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.shell.toggleNavigation }).click();
    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByRole("link", { name: en.modules.myWork.title }),
    ).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: en.modules.dashboard.title }),
    ).toHaveCount(0);
    await expect(
      sheet.getByRole("link", { name: en.modules.users.title }),
    ).toHaveCount(0);
  });

  test("the field view fits a phone without overflow or console errors", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/my-work");

    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.myWork.title }),
    ).toBeVisible();
    // The heading alone cannot tell the two branches apart: ModuleScreen draws
    // the same <h1> above the permission-denied panel, so every assertion here
    // passed just as happily on the wrong screen. Something only the rendered
    // module draws is needed, and WA-9 replaced the view note that used to play
    // that part with the field home itself — whose panel title appears on this
    // screen and on no other branch of it.
    await expect(
      page.getByText(en.dashboard.myWork.title, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(en.permissions.deniedTitle)).toHaveCount(0);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    expect(watcher.errors).toEqual([]);
  });

  test("a role that may not open a module gets an explanation, not an error", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "auditor");
    await page.goto("/en/users");

    await expect(page.getByText(en.permissions.deniedTitle)).toBeVisible();
    await expect(
      page.getByText(
        en.permissions.deniedBody.replace("{role}", en.roles.auditor.name),
      ),
    ).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });

  test("an action the role cannot perform is disabled and says why", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await page.goto("/en/work-orders");
    await hydrated(page);

    const action = page.getByRole("button", {
      name: en.actions.newWorkOrder,
    });
    await expect(action).toBeDisabled();

    // A disabled button takes neither pointer events nor focus, so the
    // explanation hangs off a focusable wrapper. Reaching it with the keyboard
    // is the case that matters.
    await page.locator('[data-slot="capability-action"]').focus();
    await expect(
      page.getByText(
        en.permissions.actionDenied.replace("{role}", en.roles.auditor.name),
      ),
    ).toBeVisible();
  });

  test("a coordinator can use the same action", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/work-orders");
    await hydrated(page);

    const action = page.getByRole("button", { name: en.actions.newWorkOrder });
    await expect(action).toBeEnabled();
    await action.click();

    // WA-27 built the form, so the action reaches it instead of saying it is
    // not built yet. The claim changed because the truth did.
    await expect(page.getByLabel(en.workOrderForm.fields.asset)).toBeFocused();
  });

  test("global search says what it will search rather than failing quietly", async ({
    page,
  }) => {
    await page.goto("/en/assets");
    await hydrated(page);
    // Scoped to the header's search landmark: the assets table has a search box
    // of its own now, and "Search" matches both by substring.
    const search = page
      .getByRole("search")
      .getByRole("searchbox", { name: en.shell.search.label });
    await search.fill("autoclave");
    await search.press("Enter");
    await expect(page.getByText(en.shell.search.hint)).toBeVisible();
  });

  test("the notifications bell opens an empty inbox that explains itself", async ({
    context,
    page,
  }) => {
    // The auditor, because the inbox is genuinely empty for that role: a
    // notification is a call to act and the auditor holds no capabilities.
    // Before WA-26 every role saw this panel, for the uninteresting reason
    // that there were no records at all.
    await useRole(context, "auditor");
    await page.goto("/en/dashboard");
    await hydrated(page);
    await page
      .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
      .click();
    await expect(
      page.getByText(en.shell.notifications.emptyTitle),
    ).toBeVisible();
  });

  test("the notifications bell counts real work for a role that has some", async ({
    context,
    page,
  }) => {
    await useRole(context, "facilityManager");
    await page.goto("/en/dashboard");
    await hydrated(page);

    const bell = page.getByRole("button", {
      name: new RegExp(en.shell.notifications.label),
    });
    // The badge is the proof the panel is describing records rather than a
    // placeholder: it only exists once the count is above zero.
    await expect(bell.locator("span[aria-hidden='true']")).toBeVisible();

    await bell.click();
    await expect(page.getByText(en.shell.notifications.emptyTitle)).toHaveCount(
      0,
    );
  });

  test("resetting the demonstration confirms first, then reports what happened", async ({
    page,
  }) => {
    await page.goto("/fr/settings");
    await hydrated(page);
    await page.getByRole("button", { name: fr.demo.reset }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: fr.demo.confirmTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: fr.demo.confirmAction }).click();

    // The reset changes the language, which remounts the locale layout, so the
    // assertion is on the state that was reset rather than on the toast.
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(
      page.getByRole("button", { name: en.shell.user.menuLabel }),
    ).toContainText(en.roles.administrator.name);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.dashboard.title }),
    ).toBeVisible();
  });

  test("the first stop in the tab order is the skip link, and it moves focus to the content", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    await hydrated(page);
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: en.shell.skipToContent });
    await expect(skip).toBeFocused();

    await skip.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("the module rail collapses and stays collapsed across a navigation", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    await hydrated(page);
    await page
      .getByRole("banner")
      .getByRole("button", { name: en.shell.toggleNavigation })
      .click();
    await expect(
      page.locator('[data-state="collapsed"]').first(),
    ).toBeAttached();

    await page.goto("/en/assets");
    await expect(
      page.locator('[data-state="collapsed"]').first(),
    ).toBeAttached();
  });

  test("an unknown address inside a locale shows the not-found screen inside the shell", async ({
    page,
  }) => {
    // Next.js answers 200 for a streamed not-found response, so the assertion
    // is on what the person sees, not on the status line.
    await page.goto("/en/nowhere");
    await expect(page.getByText(en.states.notFound.title)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: en.shell.primaryNavigation }),
    ).toBeVisible();
  });
});
