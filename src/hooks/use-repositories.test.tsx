// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import type { WorkOrderCreateInput } from "@/domain/schemas/work-order";
import { useDemoStore } from "@/stores/demo-store";
import { useRepositories } from "./use-demo-data";

/**
 * A handler that writes twice sees its own first write.
 *
 * React does not re-render inside a click handler. `useRepositories` used to
 * hand every repository the `data` of the render it was built in, so the second
 * write of a single click read the records as they were before the first — and
 * asked for a free work-order number that was no longer free. Two lanes hit it
 * in one evening: a sweep that raised one order per click instead of thirteen
 * (`applyMutation` threw `workOrders already holds id …`, and the throw escaped
 * the handler, so the person saw nothing at all), and an upload that collided
 * on the same id and version count.
 *
 * **This test is through the real hook, over the real store, in one `act()`**,
 * and that is the whole point of it. Every one of the seven repository
 * harnesses on main builds its context with `get data() { return data; }` — a
 * live getter — so each one sees the previous commit and every loop in them
 * behaves as designed. The application was the only caller passing a snapshot.
 * The suite was kinder than the product, and a green unit run said nothing
 * about a second write in one click. A harness that plants its own context
 * cannot find this defect however carefully it is written; only the hook can.
 *
 * One `act()` is not decoration either. Two writes in two `act()` calls would
 * let React re-render between them, the memo would rebuild on the new `data`,
 * and the test would pass against the defect — measuring nothing.
 */

const DAY = new Date("2026-09-12T12:00:00.000Z");
const records = buildSeed(DAY);

function order(title: string): WorkOrderCreateInput {
  return {
    title,
    description: "Raised twice in one handler, on purpose.",
    contentLanguage: "en",
    assetId: records.assets[0]!.id,
    type: "corrective",
    priority: "medium",
    dueOn: null,
    estimatedMinutes: 30,
    assignedUserId: null,
  };
}

beforeEach(() => {
  useDemoStore.setState({
    status: "ready",
    data: records,
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
    auditSequence: 0,
    outbox: [],
  });
});

it("gives a handler that writes twice its own first write", () => {
  const { result } = renderHook(() => useRepositories());
  const repositories = result.current.repositories;
  expect(
    repositories,
    "the hook produced no repositories to write with",
  ).not.toBeNull();

  const before = useDemoStore.getState().data!.workOrders.length;

  // One handler, two writes, no render in between — a click, as the browser
  // runs it.
  act(() => {
    repositories!.workOrders.create(order("First of the pair"), {
      userId: records.users[0]!.id,
      role: "maintenanceCoordinator",
    });
    repositories!.workOrders.create(order("Second of the pair"), {
      userId: records.users[0]!.id,
      role: "maintenanceCoordinator",
    });
  });

  const after = useDemoStore.getState().data!.workOrders;

  // Both landed. Before the fix the second call threw on the duplicate id, and
  // the count stopped at one.
  expect(
    after.length - before,
    "the second write of the pair never landed",
  ).toBe(2);

  const pair = after.slice(-2);
  expect(
    new Set(pair.map((one) => one.id)).size,
    "the two writes share an id",
  ).toBe(2);
  expect(
    new Set(pair.map((one) => one.number)).size,
    "the two writes share a number",
  ).toBe(2);
  expect(pair.map((one) => one.title.en)).toEqual([
    "First of the pair",
    "Second of the pair",
  ]);
});
