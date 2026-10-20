// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { offlineRefusalPages, REFUSAL_MESSAGE } from "@/lib/offline-refusal";
import { WARM_MESSAGE, WARM_ROUTES } from "@/lib/offline-routes";
import { ServiceWorker } from "./service-worker";

/**
 * What the page says to the worker, and when.
 *
 * Two things go over: the pages to answer with when an address is not on this
 * device, which cost nothing to build and are needed most when the connection
 * is gone; and the addresses to fetch into the cache, which can only be asked
 * for while there is a connection to fetch them with.
 *
 * What is asserted here is the asking. Whether the asking is enough is a
 * question only a browser can answer, and `tests/e2e/field-outbox.spec.ts`
 * answers it by switching the network off and opening a screen for real.
 */

function harness({ online }: { online: boolean }) {
  const postMessage = vi.fn();
  const worker = { postMessage };
  const registration = { active: worker };
  const register = vi.fn().mockResolvedValue(registration);

  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("navigator", {
    onLine: online,
    serviceWorker: {
      register,
      ready: Promise.resolve(registration),
      controller: worker,
    },
  });

  return { postMessage, register };
}

/** Lets the registration promise chain finish before anything is asserted. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** What the page actually said, by kind. */
function sent(postMessage: ReturnType<typeof vi.fn>, type: string) {
  return postMessage.mock.calls
    .map(([message]) => message as { type: string })
    .filter((message) => message.type === type);
}

describe("registering the worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks for the warm once, with the whole list", async () => {
    const { postMessage, register } = harness({ online: true });

    const view = render(<ServiceWorker />);
    await settle();
    view.rerender(<ServiceWorker />);
    await settle();

    expect(register).toHaveBeenCalledTimes(1);
    // Once, not once per render: the addresses are immutable and the fetches
    // are not free.
    expect(sent(postMessage, WARM_MESSAGE)).toEqual([
      { type: WARM_MESSAGE, urls: [...WARM_ROUTES] },
    ]);
    expect(WARM_ROUTES.length).toBeGreaterThan(1);
  });

  it("asks for no warm while there is no connection", async () => {
    const { postMessage, register } = harness({ online: false });

    render(<ServiceWorker />);
    await settle();

    // The chain ran, and it did say something — which is what stops this
    // passing because nothing happened at all — but not the warm. A fetch that
    // cannot succeed is not worth asking for.
    expect(register).toHaveBeenCalledTimes(1);
    expect(sent(postMessage, WARM_MESSAGE)).toEqual([]);
    expect(sent(postMessage, REFUSAL_MESSAGE)).toHaveLength(1);
  });

  it("hands over the refusal pages whatever the connection is doing", async () => {
    // They are built here rather than fetched, and they are what a person reads
    // when an address was never warmed. Withholding them offline would withhold
    // them exactly when they are the only thing left to show.
    for (const online of [true, false]) {
      const { postMessage } = harness({ online });

      render(<ServiceWorker />);
      await settle();

      expect(sent(postMessage, REFUSAL_MESSAGE), `online: ${online}`).toEqual([
        { type: REFUSAL_MESSAGE, pages: offlineRefusalPages() },
      ]);

      cleanup();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
