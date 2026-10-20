import { expect, type BrowserContext, type Page } from "@playwright/test";

export const ROLE_COOKIE = "wa_demo_role";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  phone: { width: 390, height: 844 },
} as const;

/** Sets the demo role the way the role switcher does. */
export async function useRole(context: BrowserContext, role: string) {
  await context.addCookies([
    {
      name: ROLE_COOKIE,
      value: role,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}

export interface ConsoleWatcher {
  errors: string[];
}

/**
 * Collects console errors and uncaught exceptions. A screen that logs an error
 * is a failing screen, so every navigation test asserts this is empty.
 */
export function watchConsole(page: Page): ConsoleWatcher {
  const watcher: ConsoleWatcher = { errors: [] };

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      watcher.errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    watcher.errors.push(`pageerror: ${error.message}`);
  });

  return watcher;
}

/**
 * Waits for every running transition and animation on the document to finish.
 *
 * **Why an accessibility scan needs this.** Radix opens a menu or a popover
 * with a fade and a zoom. Axe reads computed styles, so a scan that lands
 * during the fade measures half-opacity text against the page behind it and
 * reports a contrast violation that exists for a few frames and is gone before
 * anybody could see it. WA-96 is that: six `color-contrast` reds on the scans
 * that open something, and **which language failed varied between runs** —
 * the signature of a race rather than of a colour that is genuinely wrong.
 *
 * `document.getAnimations()` rather than the trigger's subtree, because Radix
 * renders the thing that animates into a **portal** at the end of the body. A
 * wait scoped to the element that was clicked would find nothing and return
 * immediately, which is a wait that reads as careful and does nothing.
 *
 * **Infinite animations are skipped**, or this would hang on the first
 * `animate-pulse` skeleton: their `finished` promise never resolves by design.
 * And the whole wait is capped, because an animation that never ends should
 * cost one second and a slightly weaker guarantee rather than a timeout thirty
 * seconds later pointing at the wrong line.
 *
 * It returns how many it waited for. That number is **not assertable** — on a
 * fast machine the transition can be over before this runs, and zero is a
 * legitimate answer. The evidence that this works is the failure rate before
 * and after, not a count inside it.
 */
export async function animationsSettled(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      if (!timing) return false;
      const iterations = timing.iterations ?? 1;
      return Number.isFinite(iterations);
    });

    await Promise.race([
      Promise.all(
        finite.map((animation) => animation.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

    return finite.length;
  });
}

/**
 * True when the page scrolls sideways, which it never should.
 *
 * **It cannot see a table that overflows inside an `overflow-x-auto` box, and
 * every register is drawn in one.** This reads the document's own scroll width,
 * so a table 200px wider than its wrapper produces no page-level overflow at
 * all: the wrapper scrolls, the document does not, and this returns false on
 * both sides of the defect. A quantity that is the same when the defect is
 * present and when it is gone is not a measurement of it.
 *
 * WA-107: the Users register ran 1604px inside a 1415px wrapper and fourteen
 * tests stayed green. A guard written for that defect walked up from
 * `[data-slot="data-table"]` looking for a clipping ancestor, found none
 * because that element *is* the wrapper, returned null, and a `!== null` check
 * turned the null into a pass.
 *
 * Use `expectTableFits` from `table-fit.ts` for anything with a table. This
 * answers a different question — whether the page itself scrolls — and it
 * answers that one correctly.
 */
export async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

/**
 * Takes the service worker out of a test's way.
 *
 * WA-15 registers a worker that caches HTML so the application opens with no
 * network. Every other spec assumes a fresh response from the server, and a
 * worker left registered would let one of them quietly assert against a page
 * built before the change under test. Playwright's contexts are isolated, so
 * this should not be necessary — but "should not" is not "does not", and a
 * flaky suite caused by caching is expensive to diagnose and cheap to prevent.
 *
 * WA-15's own spec registers explicitly instead, and asserts the registration
 * before asserting anything about being offline.
 */
export async function withoutServiceWorker(page: Page) {
  await page.addInitScript(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((one) => one.unregister())),
      )
      .catch(() => {
        // Nothing registered, which is the state we wanted anyway.
      });
  });
}

/**
 * Registers the worker, waits for it to take control, and loads a page under
 * it — rather than hoping any of the three happened.
 *
 * Active is not the same as in control. The navigation that registers a worker
 * is not intercepted by it, so nothing is cached from that load: waiting only
 * for `ready` and then going offline tests an empty cache and fails for a
 * reason that has nothing to do with caching. One reload under the active
 * worker is what fills it.
 */
export async function withServiceWorker(page: Page, path = "/en/dashboard") {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();

  const active = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    return Boolean(registration?.active);
  });
  expect(active, "the service worker never became active").toBe(true);

  // Now load it again, under the worker, so the page is cached.
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();

  const controlled = await page.evaluate(
    () => navigator.serviceWorker.controller !== null,
  );
  expect(controlled, "the page is not controlled by the service worker").toBe(
    true,
  );
}

/**
 * Waits until the screen can answer a click.
 *
 * The trap this exists for: `toBeEnabled()` is satisfied by a button the
 * server rendered, before React has bound anything to it. A test that waits
 * for enabled and then clicks is waiting for markup and acting on a handler
 * that is not there yet — the click lands on nothing, and the failure arrives
 * later, somewhere else, as a focus that never moved. It is the same family as
 * WA-42, with a click instead of a focus.
 *
 * `data-demo-status` comes from `DemoBoot`, which is mounted once in the
 * application layout and reads the store. It can only say "ready" after a
 * client component has re-rendered with an answer, so it proves both halves at
 * once: React is running, and the records are there.
 *
 * Call it after every navigation, not once per test. A wait established before
 * a `goto` says nothing about the page that `goto` loaded.
 */
export async function hydrated(page: Page) {
  await expect(page.locator('[data-demo-status="ready"]')).toBeAttached({
    timeout: 15_000,
  });
}

/**
 * Slows the browser's CPU down, when `WA_CPU_THROTTLE` asks for it.
 *
 * Off unless the variable is set, so an ordinary run is unaffected. It exists
 * because of what a race costs to prove: this machine is fast enough that the
 * gap between the layout's marker and a panel's own element closes before a
 * test can read it, so a missing wait passes here fifteen times out of fifteen
 * and fails on a slower runner. A deletion control run at full speed on a
 * defect of that shape goes green with the fix deleted, which is a control
 * that cannot fail — the thing controls exist to rule out.
 *
 * Eight is the factor WA-52's race was measured at, kept so two measurements
 * of the same kind of defect are comparable rather than each picking a number.
 *
 * Call it before `goto`: the rate applies to the work a navigation starts, and
 * a rate set afterwards has already missed the render it was meant to slow.
 */
export async function slowCpu(page: Page) {
  const rate = Number(process.env.WA_CPU_THROTTLE ?? 0);
  if (!Number.isFinite(rate) || rate <= 1) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
}

/**
 * Makes the browser's next read of the database fail.
 *
 * The instrument WA-58 was reproduced with, kept in one place because it is
 * subtle enough that two copies would drift: it replaces `indexedDB.open` for
 * the *first* call of the next document only, so the application's boot read
 * fails and everything after it — including a test's own inspection of the
 * database — runs against the real thing.
 *
 * What it produces is the `unreadable` status, which is a state no fixture can
 * plant from outside: it exists only because a real read really failed.
 * Assert `[data-demo-status="unreadable"]` after the load rather than trusting
 * that it fired, because a page that never booted would agree with every
 * assertion about what is *not* on it.
 *
 * Call it before the navigation whose read should fail.
 *
 * **`transient`** changes how long it lasts, and the default is unchanged.
 * `addInitScript` runs on *every* document, so by default each navigation and
 * each reload gets a fresh script and fails its own first read — a browser
 * that is permanently broken. WA-67's picture of the standing notice depends
 * on exactly that: it forces a failure, reloads, and photographs the result.
 *
 * `transient: true` fails only the first document in the tab, which is what a
 * real intermittent read failure looks like and the only way to test the
 * refusal's own "Try again": under the default the reload fails again, for
 * ever, and a control that recovers cannot be shown to recover. The flag lives
 * in `sessionStorage`, which survives a reload in the same tab and dies with
 * it, so nothing leaks into the next test.
 */
export async function failTheNextRead(
  page: Page,
  { transient = false }: { transient?: boolean } = {},
) {
  await page.addInitScript((transientRun: boolean) => {
    const KEY = "wa-forced-read-failure-spent";
    if (transientRun) {
      try {
        if (sessionStorage.getItem(KEY)) return;
        sessionStorage.setItem(KEY, "1");
      } catch {
        // No session storage to read means no way to tell a first document
        // from a second, and failing every read is the safer wrong answer:
        // the test times out loudly instead of passing against a browser
        // that never failed at all.
      }
    }
    const real = indexedDB.open.bind(indexedDB);
    let first = true;
    // @ts-expect-error deliberately replacing the method
    indexedDB.open = (...args: unknown[]) => {
      if (!first) return real(...(args as [string, number]));
      first = false;
      const fake: Record<string, unknown> = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        onblocked: null,
        result: null,
        error: new DOMException("forced read failure", "UnknownError"),
        readyState: "done",
      };
      setTimeout(() => {
        const handler = fake.onerror as ((e: unknown) => void) | null;
        if (handler) handler({ target: fake });
      }, 0);
      return fake;
    };
  }, transient);
}
