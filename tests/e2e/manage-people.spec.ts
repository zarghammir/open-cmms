import { expect, test, type Locator, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import { currentUserIdForRole } from "@/data/seed/people";
import { fullName } from "@/domain/types/user";
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
 * An administrator managing people, in a browser.
 *
 * The unit suite proves each write and the trail entry beside it. What only a
 * browser can answer is whether the three claims the ticket makes hold
 * *together* on the real screens: the register shows the new values, the trail
 * says who changed what, and the person's own record decides what work they may
 * be given on a screen in another module.
 *
 * **Nothing here names a person or a role.** Every subject is read off the
 * screen first — the person the assignee list is actually offering, the role
 * the register is actually showing, the options the dialog is actually
 * carrying — and the assertions are made against what was read. A test that
 * named its technician would pass or fail on which page of a paginated table
 * that person landed on, which is the defect WA-10 found the only way it can be
 * found.
 *
 * QA step 4 — the control visible, disabled, and saying why for a role that
 * may not manage people — has no case here, and the reason is worth writing
 * down rather than leaving as a gap: `/users` is the administrator's alone and
 * the administrator holds every capability, so the denied branch of
 * `CapabilityAction` is correct and unreachable from this screen today. The
 * surface that demonstrates the rule is the role table on the same page, which
 * is asserted below, and the day another role is let onto `/users` the gate is
 * already in place.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const ADMINISTRATOR = (() => {
  const id = currentUserIdForRole("administrator");
  const user = seed.users.find((one) => one.id === id);
  if (!user) throw new Error("the seed holds no administrator");
  return fullName(user);
})();

/** An ICU message with its arguments filled in, as the screen would show it. */
function sentence(template: string, params: Record<string, string>) {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  );
}

/**
 * Which column a heading is in, asked of the table rather than assumed.
 *
 * Column order is data here — `COLUMN_PRIORITIES` and the array that builds the
 * columns both decide it — so a test that counted cells from the left would
 * start reading the wrong one the day a column moves, and would still be green
 * for as long as the two happened to hold the same kind of text.
 */
async function columnIndex(
  page: Page,
  heading: string,
  strings: { dataTable: { sortBy: string } },
): Promise<number> {
  const headers = await page
    .locator('[data-slot="data-table"] thead th')
    .allTextContents();
  /*
   * A sortable header carries the column's name and, screen-reader only, the
   * sort affordance's own sentence — "NameSort by this column" is one text
   * node run together. Stripping it by the catalogue key rather than matching
   * a prefix keeps the comparison exact: a prefix match would happily accept
   * a second column whose name starts with the first one's.
   */
  const named = headers.map((text) =>
    text.replace(strings.dataTable.sortBy, "").trim(),
  );
  const index = named.findIndex((text) => text === heading);
  if (index < 0) {
    throw new Error(`no "${heading}" column among ${named.join(" | ")}`);
  }
  return index;
}

/** Every option a select is carrying, with the value the form would submit. */
async function optionsOf(select: Locator) {
  return select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      label: (node as HTMLOptionElement).textContent?.trim() ?? "",
    })),
  );
}

/**
 * The register, once the store has filled it.
 *
 * The Edit control is drawn from the records the browser read back, so its
 * presence is the store answering — unlike the heading or the table shell,
 * which the server sent before React attached a single handler.
 */
async function peopleRegister(page: Page) {
  await expect(page.locator('[data-slot="edit-person"]').first()).toBeVisible();
}

for (const locale of ["en", "fr"] as const) {
  test(`an administrator changes a person's role and site, in ${locale}`, async ({
    context,
    page,
  }) => {
    const strings = locale === "en" ? en : fr;
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "administrator");
    await page.goto(`/${locale}/users`);
    await hydrated(page);
    await peopleRegister(page);

    const nameColumn = await columnIndex(
      page,
      strings.peopleTable.columns.name,
      strings,
    );
    const roleColumn = await columnIndex(
      page,
      strings.peopleTable.columns.role,
      strings,
    );
    const siteColumn = await columnIndex(
      page,
      strings.peopleTable.columns.site,
      strings,
    );

    // The first person the register is drawing, whoever that is today.
    const firstRow = page.locator('[data-slot="data-table"] tbody tr').first();
    const person = (
      await firstRow.getByRole("cell").nth(nameColumn).textContent()
    )?.trim();
    expect(person, "the register drew a row with no name in it").toBeTruthy();
    const roleWas = await firstRow
      .getByRole("cell")
      .nth(roleColumn)
      .locator("span[title]")
      .getAttribute("title");
    const siteWas = (
      await firstRow.getByRole("cell").nth(siteColumn).textContent()
    )?.trim();

    // Back to this person by name from here on: a write can reorder the table,
    // and the first row afterwards need not be the row that was edited.
    const row = page
      .locator('[data-slot="data-table"] tbody tr')
      .filter({ hasText: person! });

    await row.locator('[data-slot="edit-person"]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const roleSelect = dialog.locator('[data-slot="person-role"]');
    const siteSelect = dialog.locator('[data-slot="person-site"]');

    // A different answer, chosen from what the dialog itself offers.
    const roleNow = await roleSelect.inputValue();
    const nextRole = (await optionsOf(roleSelect)).find(
      (option) => option.value !== roleNow,
    );
    const siteNow = await siteSelect.inputValue();
    const nextSite = (await optionsOf(siteSelect)).find(
      (option) => option.value !== siteNow,
    );
    expect(nextRole, "the dialog offers only one role").toBeTruthy();
    expect(nextSite, "the dialog offers only one site").toBeTruthy();
    /*
     * The site option reads "KGN — Kingston"; the register's cell holds the code
     * alone, which is the part people say out loud and the part the trail
     * records.
     */
    const siteCode = nextSite!.label.split("—")[0]!.trim();

    await roleSelect.selectOption(nextRole!.value);
    await siteSelect.selectOption(nextSite!.value);
    await dialog
      .getByRole("button", { name: strings.managePeople.save })
      .click();

    /*
     * The dialog closing is this application's durability signal — it stays
     * open until the write reports stored. Leaving the page on the strength of
     * the register having changed would tear the document down with the write
     * still in flight.
     */
    await expect(dialog).toBeHidden();

    // The register, reading the record back.
    await expect(
      row.getByRole("cell").nth(roleColumn),
      "the register still shows the old role",
    ).toContainText(nextRole!.label);
    await expect(
      row.getByRole("cell").nth(siteColumn),
      "the register still shows the old site",
    ).toHaveText(siteCode);

    // And the trail, in words, in this language.
    await page.goto(`/${locale}/dashboard`);
    await hydrated(page);
    const feed = page.locator('[data-slot="activity-feed"]');
    await expect(feed).toBeVisible();

    await expect(feed).toContainText(
      sentence(strings.audit.userRoleChanged, {
        user: person!,
        fromRole: roleWas!,
        toRole: nextRole!.label,
      }),
    );
    await expect(feed).toContainText(
      sentence(strings.audit.userSiteChanged, {
        user: person!,
        fromSite: siteWas!,
        toSite: siteCode,
      }),
    );
    // Who, not only what. An entry nobody is attributed to would read as the
    // application having done it.
    await expect(feed.locator("li").first()).toContainText(ADMINISTRATOR);

    expect(watcher.errors, "the console was not clean").toEqual([]);
  });
}

test("deactivating a person stops them being offered work, and reactivating starts it again", async ({
  context,
  page,
}) => {
  const watcher = watchConsole(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "administrator");

  /*
   * The subject is read from the product's own answer to "who may be given
   * work" — the create form's assignee select — rather than from a role typed
   * into this test. That is the list the change has to move, so it is the list
   * the person is taken from.
   */
  await page.goto("/en/work-orders");
  await hydrated(page);
  const assignee = page.locator("#wo-assignee");
  await expect(assignee).toBeVisible();
  await expect
    .poll(async () => (await optionsOf(assignee)).length)
    .toBeGreaterThan(2);
  const offered = (await optionsOf(assignee)).find(
    (option) => option.value !== "",
  );
  expect(offered, "the create form offers nobody at all").toBeTruthy();
  const person = offered!.label;

  await page.goto("/en/users");
  await hydrated(page);
  await peopleRegister(page);
  const stateColumn = await columnIndex(page, en.peopleTable.columns.state, en);
  const row = page
    .locator('[data-slot="data-table"] tbody tr')
    .filter({ hasText: person });

  // The floor: they are here before they leave. Without it the absence below
  // could be true of a name the register never held.
  await expect(row.getByRole("cell").nth(stateColumn)).toHaveText(
    en.peopleTable.active,
  );

  await row.locator('[data-slot="edit-person"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-slot="person-active"]').uncheck();
  await dialog.getByRole("button", { name: en.managePeople.save }).click();
  await expect(dialog).toBeHidden();

  // The register says so, rather than the person quietly vanishing.
  await expect(
    row.getByRole("cell").nth(stateColumn),
    "the register still calls them active",
  ).toHaveText(en.peopleTable.inactive);

  await page.goto("/en/work-orders");
  await hydrated(page);
  await expect(assignee).toBeVisible();
  await expect
    .poll(async () => (await optionsOf(assignee)).map((one) => one.label))
    .not.toContain(person);

  // And back again, because a demonstration that can only take people away is
  // half a demonstration.
  await page.goto("/en/users");
  await hydrated(page);
  await peopleRegister(page);
  await row.locator('[data-slot="edit-person"]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-slot="person-active"]').check();
  await dialog.getByRole("button", { name: en.managePeople.save }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/en/work-orders");
  await hydrated(page);
  await expect(assignee).toBeVisible();
  await expect
    .poll(async () => (await optionsOf(assignee)).map((one) => one.label))
    .toContain(person);

  expect(watcher.errors, "the console was not clean").toEqual([]);
});

test("the role table says who may manage people, and who may not", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "administrator");
  await page.goto("/en/users");
  await hydrated(page);

  const heading = page.getByRole("heading", { name: en.roleTable.title });
  await expect(heading).toBeVisible();

  const row = page
    .getByRole("row")
    .filter({ hasText: en.roleTable.capability.users.manage });
  await expect(row).toBeVisible();

  /*
   * The role columns are read off the table's own header, so the case names
   * the two roles it is asking about without depending on where `ROLES` puts
   * them.
   */
  /*
   * The role table's own headers. `page.locator("table thead th")` matches the
   * people register too, which sits above it on this page — so the index this
   * returned was an offset into the two tables joined end to end, and the cell
   * it named did not exist.
   */
  const headers = await page
    .locator('section[aria-labelledby="role-table-title"] table thead th')
    .allTextContents();
  const columnFor = (name: string) => {
    const index = headers.findIndex((text) => text.trim() === name);
    if (index < 0) throw new Error(`no "${name}" column in the role table`);
    return index;
  };

  await expect(
    row.getByRole("cell").nth(columnFor(en.roles.administrator.name) - 1),
  ).toHaveText(en.roleTable.may);
  await expect(
    row.getByRole("cell").nth(columnFor(en.roles.technician.name) - 1),
  ).toHaveText(en.roleTable.mayNot);
});

test("a technician landing on the address meets a refusal, not a control", async ({
  context,
  page,
}) => {
  /*
   * The enforcement, asked of the route rather than of the route table.
   *
   * The gate is what an evaluator can actually try — typing the address into
   * the bar is the first thing anybody does with a demonstration — and
   * "refused with the reason" and "rendered with the controls disabled" are
   * very different answers. `users-screen.spec.ts` already proves every
   * non-administrator role meets the refusal; what is asserted here is the
   * half this ticket added: that nothing with an action on it reaches the
   * page at all, rather than a manage control arriving disabled.
   */
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "technician");
  await page.goto("/en/users");
  await hydrated(page);

  await expect(
    page.getByText(en.permissions.deniedTitle),
    "the technician is shown nothing at all instead of being told why",
  ).toBeVisible();
  await expect(
    page.getByText(
      en.permissions.deniedBody.replace("{role}", en.roles.technician.name),
    ),
    "the refusal does not name the role holding it",
  ).toBeVisible();

  // Not disabled — absent. The screen the refusal replaces is never built.
  await expect(page.locator('[data-slot="edit-person"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="capability-action"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="data-table"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: en.roleTable.title }),
  ).toBeHidden();
});

test("an administrator can manage people on a phone, where the register is cards", async ({
  context,
  page,
}) => {
  /*
   * The column priority keeps the control from dropping at 1024 and says
   * nothing at all about 390, where the register stops being a table. A
   * management screen whose only action lives in the table is one an
   * administrator cannot use standing up.
   */
  await page.setViewportSize(VIEWPORTS.phone);
  await useRole(context, "administrator");
  await page.goto("/en/users");
  await hydrated(page);

  await expect(
    page.locator('[data-slot="data-table-cards"]'),
    "the register is still a table at this width",
  ).toBeVisible();

  const edit = page.locator('[data-slot="edit-person"]').first();
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator('[data-slot="person-role"]'),
  ).toBeVisible();
});
