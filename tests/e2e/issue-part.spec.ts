import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";

/**
 * Taking a part out of the store and onto a job, in a browser.
 *
 * WA-39 shipped `parts.issue` with tests and no caller: the only thing that
 * reached it was a test. These are the first assertions that a person can.
 */

const seed = buildSeed(new Date());

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

function openOrder(status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

async function open(page: Page, number: string, locale = "en") {
  await page.goto(`/${locale}/work-orders/${number}`);
  await hydrated(page);
}

test.describe("issuing a part to a job", () => {
  test("issues it, and the order shows it was used", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    const order = openOrder("inProgress");
    await open(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.issuePart.action })
      .click();
    await expect(
      page.getByText(en.workOrderDetail.write.issuePart.description),
    ).toBeVisible();

    // Whatever the store is offering, read from the screen rather than named in
    // advance: which parts have stock is the seed's business, not this test's.
    const parts = page.getByLabel(en.workOrderDetail.write.issuePart.part);
    const chosen = (await parts.locator("option").first().textContent()) ?? "";
    expect(chosen).not.toBe("");

    await page
      .getByLabel(en.workOrderDetail.write.issuePart.quantity)
      .fill("2");
    await page
      .getByRole("button", { name: en.workOrderDetail.write.issuePart.submit })
      .click();

    // The panel that said no parts were issued now names one.
    await expect(page.getByText(en.workOrderDetail.parts.none)).toHaveCount(0);
    const partNumber = chosen.split(" — ")[0]!.trim();
    await expect(page.getByText(partNumber).first()).toBeVisible();
  });

  test("refuses more than there are, and says so on the quantity", async ({
    context,
    page,
  }) => {
    /*
     * The repository refuses this too — that is where the rule lives. What this
     * asserts is that a person is told which field is wrong instead of being
     * thrown at, and that nothing was written.
     */
    await useRole(context, "technician");
    const order = openOrder("inProgress");
    await open(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.issuePart.action })
      .click();
    const option =
      (await page
        .getByLabel(en.workOrderDetail.write.issuePart.part)
        .locator("option")
        .first()
        .textContent()) ?? "";
    // "FLT-2101 — Filter (12 on hand)" — the bound is on screen before anybody
    // can exceed it, which is the point of putting it in the option.
    const onHand = Number(/\((\d+)\s/.exec(option)?.[1]);
    expect(Number.isFinite(onHand)).toBe(true);

    await page
      .getByLabel(en.workOrderDetail.write.issuePart.quantity)
      .fill(String(onHand + 1));
    await page
      .getByRole("button", { name: en.workOrderDetail.write.issuePart.submit })
      .click();

    await expect(page.getByText(en.validation.moreThanOnHand)).toBeVisible();
    // Nothing was written: the dialog is still open and the panel behind it
    // still says nothing has been issued.
    await expect(
      page.getByText(en.workOrderDetail.write.issuePart.description),
    ).toBeVisible();
  });

  test("an inspector is told why it is unavailable", async ({
    context,
    page,
  }) => {
    // `inventory.issue` is not `workOrder.complete`: an inspector may raise work
    // and finish an inspection, and may not take stock out of a store.
    await useRole(context, "inspector");
    await open(page, openOrder("inProgress").number);

    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.issuePart.action,
      }),
    ).toBeDisabled();
  });

  test("a completed order offers no way to issue against it", async ({
    context,
    page,
  }) => {
    // A movement against a job nobody is doing. The control is absent rather
    // than present and refusing, because the order cannot receive work at all.
    await useRole(context, "technician");
    await open(page, openOrder("completed").number);

    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.issuePart.action,
      }),
    ).toHaveCount(0);
  });

  test("reads as French", async ({ context, page }) => {
    await useRole(context, "technician");
    await open(page, openOrder("inProgress").number, "fr");

    await expect(
      page.getByRole("button", {
        name: fr.workOrderDetail.write.issuePart.action,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.issuePart.action,
      }),
    ).toHaveCount(0);
  });
});
