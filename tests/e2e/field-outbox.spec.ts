import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withServiceWorker,
} from "../fixtures/shell";

/**
 * What this device has not sent, on the screen a technician can reach.
 *
 * The synchronisation log lives in Settings, which only Administrator and
 * Facility manager can open — so the one role most likely to be working with no
 * connection was the one role that could not see its own queue. This is that
 * screen, reached from the banner that raises the question, at the width it
 * will be read on.
 *
 * Driven the way the recording will be: the network is actually switched off,
 * the order is actually raised, and the queue is actually drained.
 */

async function raiseOrder(page: Page, title: string) {
  await page
    .getByLabel(en.workOrderForm.fields.asset)
    .selectOption({ index: 1 });
  await page.getByLabel(en.workOrderForm.fields.title).fill(title);
  await page
    .getByLabel(en.workOrderForm.fields.description)
    .fill("Raised with no connection.");
  await page.getByRole("button", { name: en.workOrderForm.submit }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test.describe("the queue waiting on this device", () => {
  test("a technician reaches it from the banner and watches it drain", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);

    // Every document the browser asks for, so a refusal can be reported as a
    // refusal. Without this, a page the service worker declines to serve shows
    // up only as a heading that never appeared, which is a symptom and says
    // nothing about the cause.
    const documents: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "document") {
        documents.push({ url: response.url(), status: response.status() });
      }
    });

    // Under the worker, because this is the whole point: the screen has to be
    // reachable with the network already gone, on a device that has never
    // opened it. A test that navigated to it first would cache it and prove
    // nothing about the case it exists for.
    await withServiceWorker(page, "/en/work-orders");
    await expect(
      page.getByRole("searchbox", { name: en.workOrderQueue.searchLabel }),
    ).toBeVisible();

    await context.setOffline(true);
    await expect(
      page.locator('[data-slot="offline-banner"][data-state="offline"]'),
    ).toBeVisible();

    await raiseOrder(page, "Queued at the phone");

    // Reached the way a person reaches it: the link beside the count that
    // raised the question, not a typed address.
    await page.locator('[data-slot="queue-link"]').click();
    await page.waitForURL(/\/waiting-to-send$/);

    // The refusal first, because it is the cause. A client navigation fetches
    // an RSC payload rather than a document, so on a good run there is no
    // document response here at all; one that arrives and is not 200 is the
    // worker declining an address this device has never visited — which is the
    // address a person can only need once the network has gone. Asserted before
    // the heading so a refusal reports itself rather than showing up as a
    // heading that never appeared on a blank white page.
    const refused = documents.find(
      (document) =>
        document.url.includes("/waiting-to-send") && document.status !== 200,
    );
    expect(
      refused,
      `the navigation was refused: ${JSON.stringify(refused)}`,
    ).toBeUndefined();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: en.modules.waitingToSend.title,
      }),
    ).toBeVisible();

    // One entry, and it says what it will do rather than which row it wrote.
    const queue = page.locator('[data-slot="pending-queue"]');
    await expect(queue.getByRole("listitem")).toHaveCount(1);
    const entry = queue.getByRole("listitem").first();
    await expect(entry).toContainText(en.offline.queuedWhileOffline);

    // The number the screen is actually showing, rather than one named in
    // advance: the order was raised a moment ago and the screen knows its
    // number better than this test does.
    const said = (await entry.innerText()).trim();
    const number = said.match(/WO-\d{4}-\d{4}/)?.[0];
    expect(number, `no work-order number in: ${said}`).toBeTruthy();
    expect(said, "the entry does not say what the change will do").toContain(
      en.audit.workOrderCreated.replace("{number}", number ?? ""),
    );

    // Nothing has been sent yet, and the screen says that rather than nothing.
    await expect(page.getByText(en.offline.syncEmptyTitle)).toBeVisible();

    await context.setOffline(false);

    // The first work-order change queued offline meets the planted conflict, by
    // design: this is the demonstration's one conflict and it fires here rather
    // than on a record named in advance. So the queue does not drain on its own
    // — it stops, and a person answers. Watching that from this screen is the
    // point: the queue a technician is looking at is the queue that stopped.
    const dialog = page.locator('[data-slot="conflict-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: en.offline.conflictKeepMine })
      .click();

    // Answered: the queue empties, and what happened to the change is stated
    // in words on the same screen, naming the same record.
    await expect(page.locator('[data-slot="pending-queue"]')).toBeHidden();
    await expect(
      page.getByText(en.modules.waitingToSend.emptyTitle),
    ).toBeVisible();
    const last = page.locator('[data-slot="queue-last"]');
    await expect(last).toContainText(en.offline.outcome.keptMine);
    await expect(last).toContainText(number ?? "");

    // With the network off the browser logs every request it could not make,
    // and Next logs the one it made on our behalf: the RSC payload for the next
    // screen, whose failure is what turns the click into a full navigation —
    // the path this test exists to exercise. Both are the network being off,
    // one said by the browser and one by the framework. Filtered by exactly
    // those two signatures, so anything else still fails.
    const notTheNetwork = watcher.errors.filter(
      (message) =>
        !/net::ERR_INTERNET_DISCONNECTED/.test(message) &&
        !/Failed to fetch RSC payload/.test(message),
    );
    expect(
      notTheNetwork,
      "the application logged something that was not the network being off",
    ).toEqual([]);
  });

  test("an empty queue with no connection does not claim anything was sent", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/waiting-to-send");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: en.modules.waitingToSend.title,
      }),
    ).toBeVisible();

    await context.setOffline(true);

    // Offline and empty is not offline and sent. The two readings of an empty
    // queue are different sentences, and this is the one that must not imply
    // the server has heard anything.
    await expect(
      page.getByText(en.offline.queueEmptyOfflineTitle),
    ).toBeVisible();
    await expect(
      page.getByText(en.modules.waitingToSend.emptyTitle),
    ).toBeHidden();
  });

  test("every role can open it, including the ones that cannot open Settings", async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);

    const opens = async () => {
      await page.goto("/en/waiting-to-send");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: en.modules.waitingToSend.title,
        }),
      ).toBeVisible();
      await expect(page.getByText(en.permissions.deniedTitle)).toBeHidden();
    };

    // Technician is the reason the screen exists; auditor is the other role
    // Settings refuses. Neither may see a permission-denied panel here. Written
    // out rather than looped: `useRole` reads to the lint rules as a React hook.
    await useRole(context, "technician");
    await opens();

    await useRole(context, "auditor");
    await opens();
  });

  test("it is not in the navigation of either shell", async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Desk: the sidebar is on screen.
    await useRole(context, "administrator");
    await page.goto("/en/dashboard");
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: en.modules.waitingToSend.title }),
    ).toHaveCount(0);

    // Field: the navigation is behind the toggle, so open it first — a name
    // that is absent because the drawer is shut proves nothing.
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/my-work");
    await hydrated(page);
    await page.getByRole("button", { name: en.shell.toggleNavigation }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByRole("link", { name: en.modules.myWork.title }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: en.modules.waitingToSend.title }),
    ).toHaveCount(0);
  });

  test("an address this device never opened says so, rather than going blank", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await withServiceWorker(page, "/en/my-work");
    await context.setOffline(true);

    // Documents is a real screen, open to every role, that nothing warms and
    // this device has never opened — which is the state most of the product is
    // in on a phone that has been used for one job.
    const response = await page.goto("/en/documents");
    expect(response?.status(), "the refusal is still a refusal").toBe(504);

    // The whole point: a person can read what happened. The blank white page
    // this replaces rendered perfectly and said nothing at all.
    await expect(
      page.getByRole("heading", { level: 1, name: en.offlineRefusal.title }),
    ).toBeVisible();
    await expect(page.getByText(en.offlineRefusal.body)).toBeVisible();
    await expect(page.getByText(en.offlineRefusal.stillWorks)).toBeVisible();

    // A page a person has to read is a page axe has to pass, and this one is
    // built by hand rather than by the component library that the rest of the
    // product's accessibility rests on.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      `the refusal page: ${JSON.stringify(results.violations)}`,
    ).toEqual([]);

    // And a way back that cannot itself be missing: the page they came from is
    // the one address certainly on this device.
    await page.getByRole("button", { name: en.offlineRefusal.back }).click();
    await expect(page).toHaveURL(/\/en\/my-work$/);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.myWork.title }),
    ).toBeVisible();
  });

  test("the refusal is in the language of the address", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await withServiceWorker(page, "/fr/my-work");
    await context.setOffline(true);

    await page.goto("/fr/documents");

    // The address is all the worker has to go on, and it is enough. A refusal
    // in the wrong language is a second thing gone wrong at the moment the
    // first one is being explained.
    await expect(
      page.getByRole("heading", { level: 1, name: fr.offlineRefusal.title }),
    ).toBeVisible();
    await expect(
      page.getByText(en.offlineRefusal.title, { exact: true }),
    ).toBeHidden();
    expect(await page.locator("html").getAttribute("lang")).toBe("fr-CA");
  });

  test("has no accessibility violations at 390, in both languages", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);

    for (const [path, title] of [
      ["/en/waiting-to-send", en.modules.waitingToSend.title],
      ["/fr/waiting-to-send", fr.modules.waitingToSend.title],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations,
        `${path}: ${JSON.stringify(results.violations)}`,
      ).toEqual([]);
    }
  });
});
