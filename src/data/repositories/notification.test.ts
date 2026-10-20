import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { applyMutation, applyMutations } from "@/stores/mutations";
import { createNotificationRepository } from "./notification";
import type { RepositoryContext } from "./types";

const NOW = new Date("2026-09-12T14:05:00.000Z");

function harness(seed: DemoData = buildSeed(NOW)) {
  let data = seed;
  let sequence = 0;
  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      data = applyMutation(data, mutation, at ?? NOW.toISOString(), "aud-1");
    },
    commitMany(mutations, audit, actor, entityId, at) {
      sequence += 1;
      data = applyMutations(
        data,
        mutations,
        audit,
        actor,
        entityId,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    now: () => NOW,
  };
  return {
    repository: createNotificationRepository(context),
    get data() {
      return data;
    },
  };
}

describe("who a notification reaches", () => {
  const seed = buildSeed(NOW);
  const { repository } = harness(seed);

  it("the seed raises notifications at all", () => {
    // Without this the counts below could all be zero and every assertion
    // would pass while describing an empty inbox.
    expect(seed.notifications.length).toBeGreaterThan(5);
  });

  it("reaches the role it is addressed to", () => {
    const coordinator = repository.forRole("maintenanceCoordinator");
    expect(coordinator.length).toBeGreaterThan(0);
    expect(
      coordinator.every(
        (notification) => notification.forRole === "maintenanceCoordinator",
      ),
    ).toBe(true);
  });

  it("reaches the administrator, whatever role it was addressed to", () => {
    // The role a reviewer opens the demonstration in must not have an empty
    // inbox while overdue work and short stock sit in the records.
    expect(repository.forRole("administrator")).toHaveLength(
      seed.notifications.length,
    );
    expect(repository.unreadCount("administrator")).toBeGreaterThan(0);
  });

  it("does not reach a role it was not addressed to", () => {
    const technician = repository.forRole("technician");
    expect(technician).toEqual([]);
  });

  it("counts only what is unread", () => {
    const test = harness(buildSeed(NOW));
    const before = test.repository.unreadCount("administrator");
    const first = test.repository.forRole("administrator")[0]!;

    test.repository.markRead(first.id, {
      userId: "usr-fortin",
      role: "administrator",
    });

    expect(test.repository.unreadCount("administrator")).toBe(before - 1);
    // The notification is still there; only its state changed.
    expect(test.repository.forRole("administrator")).toHaveLength(
      test.data.notifications.length,
    );
  });

  it("newest first", () => {
    const dates = repository
      .forRole("administrator")
      .map((notification) => notification.createdAt);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });
});
