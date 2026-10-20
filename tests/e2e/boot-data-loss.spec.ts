import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import {
  failTheNextRead,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";

async function auditCount(page: Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "workaxis")) return -1;
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("workaxis", 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!db.objectStoreNames.contains("state")) return -2;
    const raw = await new Promise<string | undefined>((res, rej) => {
      const r = db
        .transaction("state", "readonly")
        .objectStore("state")
        .get("workaxis-demo");
      r.onsuccess = () => res(r.result as string | undefined);
      r.onerror = () => rej(r.error);
    });
    db.close();
    if (!raw) return -3;
    const blob = JSON.parse(raw) as {
      state: { data: { auditEvents: unknown[] } | null };
    };
    return blob.state.data?.auditEvents.length ?? -4;
  });
}

/**
 * A read that failed is not an empty store.
 *
 * The boot reads the records back, and if that read fails the failure is
 * swallowed: `getItem` returns null, persist sees no stored value, and
 * `ensureSeeded` treats it as a first visit and builds a fresh seed — over the
 * top of everything the person had done. Measured before the fix: a trail
 * holding 119 events came back 118, three runs of three, with nothing logged.
 *
 * One forced failure of the first `indexedDB.open` is all it takes, which is
 * what this arranges. What it asserts is the only thing that matters to the
 * person: their change is still there afterwards.
 */
test("a failed read does not destroy the records", async ({
  context,
  page,
}) => {
  await withoutServiceWorker(page);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/work-orders");
  await hydrated(page);

  // One change by a person: raise a work order.
  await page
    .getByLabel(en.workOrderForm.fields.asset)
    .selectOption({ index: 1 });
  await page.getByLabel(en.workOrderForm.fields.title).fill("WA-58 probe job");
  await page
    .getByLabel(en.workOrderForm.fields.description)
    .fill("Raised for the reproduction.");
  const baseline = await auditCount(page);
  await page.getByRole("button", { name: en.workOrderForm.submit }).click();

  // The person's change has landed when the trail has grown, which is the
  // thing this reproduction is about — not when any particular panel redraws.
  await expect
    .poll(() => auditCount(page), { timeout: 15_000 })
    .toBeGreaterThan(baseline);
  const before = await auditCount(page);

  // Now make the FIRST indexedDB.open of the next document reject.
  await failTheNextRead(page);

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 80));
  });

  await page.reload();

  /*
   * The floor, before anything is counted.
   *
   * Both assertions in this test are satisfied by a run in which the forced
   * failure never fired: the change landed, and the count is unchanged because
   * nothing went wrong. So if `failTheNextRead` ever silently stopped working —
   * a browser that stops letting `indexedDB.open` be replaced, a boot that
   * opens the database twice, a rename — this test would go green having
   * tested nothing at all, which is the disguise the original defect wore.
   *
   * `DemoBoot` renders the store's own status into the layout, so this is the
   * application saying the read failed rather than the fixture claiming it made
   * it fail. The fixture's own docblock asks every caller to do this; until now
   * the only caller did not.
   */
  await expect(
    page.locator('[data-demo-status="unreadable"]'),
    "the forced failure never reached the store: the count below would agree with a run in which nothing failed",
  ).toBeAttached({ timeout: 15_000 });

  await page.waitForTimeout(3000);

  const after = await auditCount(page);

  // The person's change survives a failed read. Before the fix this was 118:
  // a fresh seed written over the top of it, with nothing logged — the count
  // and the silence were measured together, three runs of three.
  expect(
    after,
    `the records were rebuilt over the person's change: ${before} became ${after}; console errors: ${errors.length}`,
  ).toBe(before);
});
