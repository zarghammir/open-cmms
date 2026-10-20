import { beforeEach, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import type { Notification } from "@/domain/types";
import { useDemoStore } from "./demo-store";
import { whenFlushed } from "./idb-storage";

/**
 * A sweep adds notices without claiming anybody did anything.
 *
 * The rules read the records and work out who should hear about them. That is
 * **derived state**: nothing was done to the records, so there is nothing to
 * send to a server and nothing to record in the trail.
 *
 * Writing them through `commitMany` made both claims, and the browser suite
 * named both in one run: a queue entry per sweep, so a technician's "waiting to
 * send" screen filled with work nobody did; and "Raised 67 notifications" as
 * the newest line in the trail, signed by whoever was holding the
 * demonstration, sitting directly above the entry explaining why their records
 * had just been discarded.
 *
 * Both assertions below are about what must **not** happen, so each is paired
 * with a positive: the notices really do arrive. A test made only of absences
 * passes perfectly against a function that does nothing at all.
 */

const DAY = new Date("2026-09-15T12:00:00.000Z");

function notice(id: string): Notification {
  return {
    id,
    organizationId: "org-1",
    kind: "workOrderOverdue",
    messageKey: "notifications.workOrderOverdue",
    params: { number: "WO-2026-0001", dueAt: "2026-09-10" },
    subject: { entity: "workOrder", id: "wko-1" },
    createdAt: DAY.toISOString(),
    readAt: null,
    forUserId: "usr-1",
    forRole: null,
    eventKey: `overdue:wko-1:2026-09-10|${id}`,
  };
}

beforeEach(async () => {
  useDemoStore.setState({
    status: "ready",
    data: buildSeed(DAY),
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
    auditSequence: 0,
    outbox: [],
  });
  await whenFlushed();
});

it("adds the notices, and the log lines beside them", () => {
  const before = useDemoStore.getState().data!.notifications.length;

  useDemoStore.getState().applyDerived({
    notifications: [notice("ntf-a"), notice("ntf-b")],
    emailLog: [
      {
        id: "eml-a",
        organizationId: "org-1",
        notificationId: "ntf-a",
        toUserId: "usr-1",
        toEmail: "somebody@example.test",
        language: "fr",
        subjectKey: "notifications.workOrderOverdueSubject",
        params: { number: "WO-2026-0001" },
        queuedAt: DAY.toISOString(),
      },
    ],
  });

  const data = useDemoStore.getState().data!;
  expect(data.notifications.length, "the notices never arrived").toBe(
    before + 2,
  );
  expect(data.emailLog.length, "the log line never arrived").toBe(1);
});

it("queues nothing, because a rule's conclusion is not a change to send", () => {
  expect(
    useDemoStore.getState().outbox,
    "the queue was not empty to begin with, so this proves nothing",
  ).toHaveLength(0);

  useDemoStore.getState().applyDerived({
    notifications: [notice("ntf-a")],
    emailLog: [],
  });

  expect(
    useDemoStore.getState().outbox,
    "a sweep put work in the queue that nobody did",
  ).toHaveLength(0);
});

it("leaves the trail exactly as it found it", () => {
  const trail = useDemoStore.getState().data!.auditEvents;
  const before = trail.length;
  const newest = trail[0]!.summaryKey;
  expect(
    before,
    "the seed wrote no trail, so nothing below is a comparison",
  ).toBeGreaterThan(0);

  useDemoStore.getState().applyDerived({
    notifications: [notice("ntf-a"), notice("ntf-b")],
    emailLog: [],
  });

  const after = useDemoStore.getState().data!.auditEvents;
  expect(after.length, "a sweep wrote a line into the trail").toBe(before);
  /*
   * And the first entry is the same one, which is the promise WA-44 made and
   * this broke: after a rebuild, the first thing the trail says is why
   * everything before it is gone. A count alone would pass against a write
   * that replaced an entry rather than adding one.
   */
  expect(after[0]!.summaryKey, "the newest entry in the trail changed").toBe(
    newest,
  );
});

it("writes nothing when there is nothing to write", () => {
  const data = useDemoStore.getState().data!;
  useDemoStore.getState().applyDerived({ notifications: [], emailLog: [] });
  expect(
    useDemoStore.getState().data,
    "an empty sweep replaced the records with a copy",
  ).toBe(data);
});
