// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import type { PendingChange } from "@/hooks/use-demo-data";
import { formats } from "@/i18n/formats";
import { PendingQueue } from "./pending-queue";

/**
 * An empty queue reads three ways, and the screen has to tell them apart.
 *
 * Nothing waiting, nothing changed yet, and nothing known yet are three
 * different answers. The third is the one that matters: before the browser has
 * read the database back there is no queue *and no answer*, and a screen that
 * said "everything has been sent" in that moment would be telling a technician
 * in a plant room that work they can still see on the screen has left the
 * tablet. The deletion control for the whole file is to make the unknown state
 * render like the empty one and watch the first test fail.
 */

const QUEUE_STATE: {
  current: {
    changes: PendingChange[] | null;
    online: boolean;
    stoppedOn: string | null;
    last: {
      id: string;
      subject: string;
      label: string;
      at: string;
      outcome: string;
    } | null;
  };
} = vi.hoisted(() => ({
  current: { changes: null, online: true, stoppedOn: null, last: null },
}));

vi.mock("@/hooks/use-demo-data", () => ({
  usePendingQueue: () => QUEUE_STATE.current,
}));

function change(overrides: Partial<PendingChange> = {}): PendingChange {
  return {
    id: "out-1",
    label: "WO-2026-0041",
    phrase: {
      summaryKey: "audit.workOrderCreated",
      summaryParams: { number: "WO-2026-0041" },
    },
    queuedOffline: true,
    queuedAt: "2026-09-13T18:32:00.000Z",
    actorRole: "technician",
    ...overrides,
  };
}

function mount() {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      <PendingQueue role="technician" />
    </NextIntlClientProvider>,
  );
}

describe("the queue waiting on this device", () => {
  beforeEach(() => {
    QUEUE_STATE.current = {
      changes: null,
      online: true,
      stoppedOn: null,
      last: null,
    };
  });

  it("says nothing at all until the records have been read", () => {
    mount();

    expect(
      document.querySelector('[data-slot="data-table-skeleton"]'),
    ).not.toBeNull();
    // Neither empty state, in either direction: no answer is not an answer.
    expect(screen.queryByText(en.modules.waitingToSend.emptyTitle)).toBeNull();
    expect(screen.queryByText(en.offline.queueEmptyOfflineTitle)).toBeNull();
  });

  it("says everything has been sent when the queue is empty and there is a connection", () => {
    QUEUE_STATE.current = { ...QUEUE_STATE.current, changes: [], online: true };
    mount();

    expect(screen.getByText(en.modules.waitingToSend.emptyTitle)).toBeVisible();
    expect(screen.queryByText(en.offline.queueEmptyOfflineTitle)).toBeNull();
  });

  it("says only that nothing is waiting when the queue is empty and there is no connection", () => {
    // Offline and empty is not offline and sent. Nothing has reached the
    // server, and the screen must not imply it has.
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [],
      online: false,
    };
    mount();

    expect(screen.getByText(en.offline.queueEmptyOfflineTitle)).toBeVisible();
    expect(screen.queryByText(en.modules.waitingToSend.emptyTitle)).toBeNull();
  });

  it("says what each waiting change will do, in the words the trail will use", () => {
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [change()],
      online: false,
    };
    mount();

    expect(
      screen.getByText(
        en.audit.workOrderCreated.replace("{number}", "WO-2026-0041"),
      ),
    ).toBeVisible();
    expect(screen.getByText(en.offline.queuedWhileOffline)).toBeVisible();
  });

  it("names the role that wrote a change somebody else made, and only then", () => {
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [change({ actorRole: "administrator" })],
    };
    const mine = mount();

    expect(
      screen.getByText(
        en.offline.queuedByRole.replace("{role}", en.roles.administrator.name),
      ),
    ).toBeVisible();

    mine.unmount();
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [change({ actorRole: "technician" })],
    };
    mount();

    expect(
      screen.queryByText(
        en.offline.queuedByRole.replace("{role}", en.roles.technician.name),
      ),
    ).toBeNull();
  });

  it("says the queue is stopped, and on which record", () => {
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [change()],
      stoppedOn: "WO-2026-0041",
    };
    mount();

    expect(
      screen.getByText(
        en.offline.queueStopped.replace("{record}", "WO-2026-0041"),
      ),
    ).toBeVisible();
  });

  it("says what happened last, or that nothing has been sent yet", () => {
    QUEUE_STATE.current = { ...QUEUE_STATE.current, changes: [] };
    const first = mount();
    expect(screen.getByText(en.offline.syncEmptyTitle)).toBeVisible();

    first.unmount();
    QUEUE_STATE.current = {
      ...QUEUE_STATE.current,
      changes: [],
      last: {
        id: "out-9",
        subject: "workOrders:wko-1",
        label: "WO-2026-0037",
        at: "2026-09-13T18:32:00.000Z",
        outcome: "conflicted",
      },
    };
    mount();

    // The outcome in words, including when the outcome was a refusal: a log
    // that only ever says "sent" is a log nobody needs.
    expect(screen.getByText(en.offline.outcome.conflicted)).toBeVisible();
    expect(screen.getByText("WO-2026-0037")).toBeVisible();
    expect(screen.queryByText(en.offline.syncEmptyTitle)).toBeNull();
  });
});
