import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFUSAL_MESSAGE, refusalKey } from "@/lib/offline-refusal";
import { WARM_MESSAGE } from "@/lib/offline-routes";

/**
 * The page and the worker agree on one word.
 *
 * `public/sw.js` is served as a file rather than bundled, so it cannot import
 * anything from `src` — the name of the message it listens for is written out
 * in it, and the name the page sends is `WARM_MESSAGE`. Nothing in the type
 * system connects the two: rename the constant and both sides still use the
 * constant, both compile, and the component test still passes, because it
 * asserts the page sent whatever the constant says. The only thing that would
 * have noticed is the browser case that switches the network off.
 *
 * So this reads the worker as text and checks the word is in it. It is not a
 * pretty test; it is the cheapest thing that fails when the two drift apart.
 * Asserted against the imported constant rather than the literal, because a
 * literal here would be a second copy of the value and would agree with itself.
 */

const WORKER = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("the service worker's contract with the page", () => {
  it("listens for the message the page sends", () => {
    // A floor first. Without it a wrong path or an emptied file reads as "" and
    // the check below fails as a broken contract rather than as a file nobody
    // managed to read.
    expect(WORKER.length, "public/sw.js was not read").toBeGreaterThan(500);

    expect(
      WORKER,
      "the worker does not listen for the message the page sends",
    ).toContain(WARM_MESSAGE);

    expect(
      WORKER,
      "the worker does not listen for the refusal pages the page sends",
    ).toContain(REFUSAL_MESSAGE);

    // The worker builds the same key the page builds, and neither imports the
    // other. A page kept under one spelling and looked up under another is a
    // refusal that is stored and never found, which reads exactly like the
    // blank page this replaced.
    expect(
      WORKER,
      "the worker does not key the refusal pages the way the page does",
    ).toContain(refusalKey("").replace(/\/$/, ""));
  });
});
