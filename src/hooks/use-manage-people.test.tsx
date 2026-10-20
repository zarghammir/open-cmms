// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { useDemoStore } from "@/stores/demo-store";
import { useManagePeople } from "./use-manage-people";

/**
 * Two changes to one person, in one click.
 *
 * The repository's own test proves each write on its own. This proves the pair
 * through the real hook over the real store in a single `act()`, which is the
 * one thing a planted context cannot check: the second call has to see the
 * records the first left behind, and a handler does not re-render between them.
 * `use-repositories.test.tsx` carries the reasoning — the application was the
 * only caller that ever passed a snapshot, and the suite was kinder than the
 * product.
 */

const DAY = new Date("2026-09-12T12:00:00.000Z");
const records = buildSeed(DAY);

function aTechnician() {
  const found = records.users.find((one) => one.role === "technician");
  if (!found) throw new Error("the seed holds no technician");
  return found;
}

function storedUser(id: string) {
  const found = useDemoStore
    .getState()
    .data!.users.find((one) => one.id === id);
  if (!found) throw new Error(`no user ${id} in the store`);
  return found;
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

describe("an administrator editing a person", () => {
  it("lands every change of one submission and counts them", () => {
    const person = aTechnician();
    const elsewhere = records.facilities.find(
      (one) => one.id !== person.homeFacilityId,
    )!;
    const { result } = renderHook(() => useManagePeople("administrator"));

    let written = 0;
    act(() => {
      written = result.current.apply(person.id, {
        role: "maintenanceCoordinator",
        homeFacilityId: elsewhere.id,
        active: false,
      });
    });

    expect(written, "not every change of the submission was written").toBe(3);

    const after = storedUser(person.id);
    expect(after.role).toBe("maintenanceCoordinator");
    expect(after.homeFacilityId).toBe(elsewhere.id);
    expect(after.active).toBe(false);

    // Three acts, three sentences — not one entry with three fields on it.
    const trail = useDemoStore
      .getState()
      .data!.auditEvents.filter(
        (event) => event.entity === "user" && event.entityId === person.id,
      );
    expect(trail).toHaveLength(3);
    expect(new Set(trail.map((entry) => entry.summaryKey)).size).toBe(3);
  });

  it("writes nothing for a submission that changes nothing", () => {
    const person = aTechnician();
    const { result } = renderHook(() => useManagePeople("administrator"));
    const before = useDemoStore.getState().data!.auditEvents.length;

    let written = 1;
    act(() => {
      written = result.current.apply(person.id, {
        role: person.role,
        homeFacilityId: person.homeFacilityId,
        active: person.active,
      });
    });

    expect(written).toBe(0);
    expect(useDemoStore.getState().data!.auditEvents).toHaveLength(before);
  });
});

describe("who may edit at all", () => {
  it("answers for the role rather than leaving the screen to guess", () => {
    const admin = renderHook(() => useManagePeople("administrator"));
    expect(admin.result.current.editable).toBe(true);

    const technician = renderHook(() => useManagePeople("technician"));
    expect(technician.result.current.editable).toBe(false);
  });
});
