import { expect, test } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import en from "../../messages/en.json";
import {
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

/**
 * Labels and scanning, in a real browser.
 *
 * The test that matters is the round trip: it photographs the QR the
 * application actually rendered and feeds that picture back into the scanner.
 * Asserting that a string encodes and decodes would prove nothing — the same
 * code would be on both ends. Going through a rendered image and a real
 * decoder is the only way to find out whether what comes off a label is what
 * went onto it.
 */

// The seed is pure and keyed to the day, so the browser fills itself with the
// same records this file computes.
const seed = buildSeed(new Date());
const asset = seed.assets[0]!;
const part = seed.parts.find((candidate) => candidate.quantityOnHand > 0)!;

/**
 * Identifiers are matched exactly. The QR carries an accessible `<title>` that
 * *contains* the identifier ("QR code that opens AHU-KGN-11"), and a substring
 * match resolves to that hidden element rather than to the text on the label.
 */
function message(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, value),
    template,
  );
}

test.describe("labels", () => {
  test("an asset label carries the tag, a QR and a barcode", async ({
    page,
  }) => {
    const watcher = watchConsole(page);
    await page.goto(`/en/assets/${asset.assetTag}/label`);

    await expect(page.getByText(asset.assetTag, { exact: true })).toBeVisible();
    await expect(page.locator("[data-qr] svg")).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: message(en.label.barcodeAlt, { identifier: asset.assetTag }),
      }),
    ).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });

  test("a part label works the same way", async ({ page }) => {
    await page.goto(`/en/inventory/${part.partNumber}/label`);
    await expect(
      page.getByText(part.partNumber, { exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-qr] svg")).toBeVisible();
  });

  test("an identifier nothing holds is refused rather than guessed at", async ({
    page,
  }) => {
    await page.goto("/en/assets/AHU-KGN-99/label");
    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
    // The control: the same route with a real tag does find its record, so the
    // refusal above is a refusal and not a broken route.
    await page.goto(`/en/assets/${asset.assetTag}/label`);
    await expect(page.getByText(en.records.missingTitle)).toHaveCount(0);
  });
});

test.describe("scanning", () => {
  test("a photograph of a label opens the record it names", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");

    await page.goto(`/en/assets/${asset.assetTag}/label`);
    const code = page.locator("[data-qr]");
    await expect(code).toBeVisible();
    const photograph = await code.screenshot();

    await page.goto("/en/my-work/scan");
    await hydrated(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: "label.png",
      mimeType: "image/png",
      buffer: photograph,
    });

    await expect(page.getByText(en.scan.foundAsset)).toBeVisible();
    await expect(page.getByText(asset.assetTag, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: en.scan.open }).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/assets/${asset.assetTag}/label$`),
    );
  });

  test("a picture with no code in it is not recognised, and says so", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    await page.goto("/en/my-work/scan");

    // A 1×1 white PNG: a real image, with nothing to read in it.
    const blank = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "blank.png",
      mimeType: "image/png",
      buffer: blank,
    });

    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
  });

  test("a blocked camera explains itself and the photo path stays offered", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");

    // Refusing the camera deterministically. Headless Chromium fails
    // `getUserMedia` with "no device", which is a different branch from the
    // one a technician hits when a browser has been told no.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => [
            { kind: "videoinput", deviceId: "camera", label: "", groupId: "" },
          ],
          getUserMedia: async () => {
            throw new DOMException("Permission denied", "NotAllowedError");
          },
        },
      });
    });

    await page.goto("/en/my-work/scan");
    await hydrated(page);
    await page.getByRole("button", { name: en.scan.startCamera }).click();

    await expect(page.getByText(en.scan.deniedTitle)).toBeVisible();
    // The upload is not a consolation prize offered after the failure: it was
    // on the screen before the camera was ever tried, and it still is.
    await expect(
      page.getByRole("button", { name: en.scan.uploadAction }),
    ).toBeVisible();
  });
});

test.describe("inventory verification", () => {
  test("a counted difference is written to the records", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");

    await page.goto(`/en/inventory/${part.partNumber}/label`);
    const photograph = await page.locator("[data-qr]").screenshot();

    await page.goto("/en/inventory/verify");
    await hydrated(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: "part.png",
      mimeType: "image/png",
      buffer: photograph,
    });

    await expect(
      page.getByText(part.partNumber, { exact: true }),
    ).toBeVisible();

    await page
      .getByLabel(en.verify.countedLabel)
      .fill(String(part.quantityOnHand + 2));
    await page.getByRole("button", { name: en.verify.record }).click();

    await expect(page.getByText(en.verify.rowAdjusted)).toBeVisible();
  });

  test("a count that matches changes nothing, and says nothing changed", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");

    await page.goto(`/en/inventory/${part.partNumber}/label`);
    const photograph = await page.locator("[data-qr]").screenshot();

    await page.goto("/en/inventory/verify");
    await hydrated(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: "part.png",
      mimeType: "image/png",
      buffer: photograph,
    });
    await expect(
      page.getByText(part.partNumber, { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.verify.record }).click();
    await expect(page.getByText(en.verify.rowConfirmed)).toBeVisible();
  });

  test("a role that may not change stock is told, not silently ignored", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await page.goto("/en/inventory/verify");
    await expect(page.getByText(en.verify.readOnlyTitle)).toBeVisible();
  });
});
