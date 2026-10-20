// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { formats } from "@/i18n/formats";
import { useDemoStore, type DemoStatus } from "@/stores/demo-store";
import en from "../../messages/en.json";
import { useAsset } from "./use-asset";
import { useLabelContent } from "./use-label-content";
import { useWorkOrder } from "./use-work-order";

/**
 * Three hooks that ask the wrong question and get away with it.
 *
 * Each one gates on `status === "unknown"`, which stopped meaning "not ready"
 * when WA-58 added a third member to the union. All three are nonetheless
 * correct today — but only because of the clause beside it: `useRepositories`
 * returns null whenever `data` is null, and a failed read happens to leave
 * `data` at its initial null. Not one of them is protected by the check that
 * was written to protect it.
 *
 * `unreadable` is defined as a state about records that exist and were not
 * fetched. That `data` is null in it is a property of this implementation, not
 * of what the state means: a retry that partly succeeds, a recovery path, or a
 * refusal screen that shows what it could salvage all leave the read classed
 * as failed with records in hand — and all three hooks then hand a screen
 * records from a store whose read failed, which is harder to see than a blank
 * page because a hook returning data looks like a hook that worked.
 *
 * So the state is planted rather than produced. That is normally the wrong way
 * to test — a fixture that meets the subject where a person never goes — and
 * here it is the whole point: there is no path to this state yet, and the test
 * exists to say that the hooks must not depend on there never being one. The
 * two screens that *are* reachable today are covered in a browser, by a real
 * forced failure, in `tests/e2e/unreadable-consumers.spec.ts`.
 *
 * Every case has its positive twin. An assertion that a hook answers "unknown"
 * is satisfied by a hook that answers "unknown" to everything — a wrong
 * identifier, an empty store, a seed that changed its field names — so the
 * same call with the read having succeeded has to find the record.
 */

const DAY = new Date("2026-09-12T12:00:00.000Z");
const records = buildSeed(DAY);
const NUMBER = records.workOrders[0]!.number;
const TAG = records.assets[0]!.assetTag;

function plant(status: DemoStatus) {
  useDemoStore.setState({
    status,
    data: records,
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  useDemoStore.setState({
    status: "unknown",
    data: null,
    seededOn: null,
    seedVersion: SEED_VERSION,
    hydrated: false,
  });
});

it("useWorkOrder does not answer out of a store whose read failed", () => {
  plant("ready");
  expect(
    renderHook(() => useWorkOrder(NUMBER), { wrapper }).result.current.state,
    "the control found nothing: this case proves nothing about the status",
  ).toBe("found");

  plant("unreadable");
  expect(
    renderHook(() => useWorkOrder(NUMBER), { wrapper }).result.current.state,
  ).toBe("unknown");
});

it("useAsset does not answer out of a store whose read failed", () => {
  plant("ready");
  expect(
    renderHook(() => useAsset(TAG), { wrapper }).result.current.state,
    "the control found nothing: this case proves nothing about the status",
  ).toBe("found");

  plant("unreadable");
  expect(
    renderHook(() => useAsset(TAG), { wrapper }).result.current.state,
  ).toBe("unknown");
});

it("useLabelContent does not print a label out of a store whose read failed", () => {
  plant("ready");
  expect(
    renderHook(() => useLabelContent("asset", TAG), { wrapper }).result.current
      .state,
    "the control found nothing: this case proves nothing about the status",
  ).toBe("found");

  plant("unreadable");
  expect(
    renderHook(() => useLabelContent("asset", TAG), { wrapper }).result.current
      .state,
  ).toBe("unknown");
});
