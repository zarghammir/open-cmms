// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import type { ActivityRow } from "@/data/selectors/dashboard";
import type { AuditEvent } from "@/domain/types";
import { formats } from "@/i18n/formats";
import { ActivityPanel } from "./activity-panel";

/*
 * The providers carry `formats` because the application does, through
 * `src/i18n/request.ts`. Without it a named format is not found and next-intl
 * hands the sentence the `Date` itself, which stringifies as "Mon Sep 14 2026
 * 05:00:00 GMT-0700" — a test that omitted them would have been rendering
 * something no reader will ever see.
 */
function withMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function inFrench(ui: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="fr-CA"
      messages={fr}
      timeZone="America/Toronto"
      formats={formats}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function importEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return event({
    entity: "importBatch",
    entityId: "imp-1",
    action: "imported",
    summaryKey: "audit.importCommitted",
    summaryParams: { fileName: "mp2-export-sample.xlsx", records: 240 },
    ...overrides,
  });
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "aud-1",
    organizationId: "org-1",
    at: "2026-09-12T14:05:00.000Z",
    actorKind: "person",
    actorUserId: "usr-1",
    actorRole: "maintenanceCoordinator",
    entity: "workOrder",
    entityId: "wko-1",
    action: "statusChanged",
    summaryKey: "audit.statusChanged",
    summaryParams: { number: "WO-2026-0001", status: "waitingForParts" },
    changes: [],
    ...overrides,
  };
}

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    event: event(),
    actor: { kind: "person", name: "Dana Whitfield" },
    ...overrides,
  };
}

describe("ActivityPanel", () => {
  it("says the status in words rather than in the value it was stored as", () => {
    // The trap this guards: `status` holds a domain value, so an entry written
    // in August reads "moved to waitingForParts" in both languages unless it
    // goes through the catalogue on the way out.
    withMessages(<ActivityPanel rows={[row()]} />);

    expect(
      screen.getByText(
        `WO-2026-0001 moved to ${en.workOrderStatus.waitingForParts}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/waitingForParts/)).not.toBeInTheDocument();
  });

  it("names the person who made the change", () => {
    withMessages(<ActivityPanel rows={[row()]} />);

    expect(screen.getByText(/Dana Whitfield/)).toBeInTheDocument();
  });

  it("says an author it could not resolve is unattributed, not the system", () => {
    withMessages(
      <ActivityPanel rows={[row({ actor: { kind: "unattributed" } })]} />,
    );

    expect(
      screen.getByText(new RegExp(en.dashboard.activity.unknownActor)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(en.dashboard.activity.systemActor)),
    ).not.toBeInTheDocument();
  });

  it("reads the rebuild as a sentence in both languages", () => {
    // The entry a person meets after a deploy, on the screen they meet it on.
    // The store writes a key and its arguments; this is the half that turns
    // them back into something a reader can act on, and it has to do it in
    // French too — the version numbers are the same in both, the sentence
    // around them is not.
    const rebuild = row({
      actor: { kind: "system" },
      event: event({
        actorKind: "system",
        action: "rebuilt",
        entity: "demo",
        summaryKey: "audit.dataRebuilt",
        summaryParams: { version: 4, previousVersion: 3 },
      }),
    });

    const english = withMessages(<ActivityPanel rows={[rebuild]} />);
    expect(
      screen.getByText(
        en.audit.dataRebuilt
          .replace("{version}", "4")
          .replace("{previousVersion}", "3"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(en.dashboard.activity.systemActor)),
    ).toBeInTheDocument();

    english.unmount();
    inFrench(<ActivityPanel rows={[rebuild]} />);
    expect(
      screen.getByText(
        fr.audit.dataRebuilt
          .replace("{version}", "4")
          .replace("{previousVersion}", "3"),
      ),
    ).toBeInTheDocument();
  });

  it("reads the day refresh as a sentence in both languages", () => {
    const refreshed = row({
      actor: { kind: "system" },
      event: event({
        actorKind: "system",
        action: "rebuilt",
        entity: "demo",
        summaryKey: "audit.dataRefreshed",
        summaryParams: { day: "2026-09-14", previousDay: "2026-09-13" },
      }),
    });

    // The days are stored as 2026-09-14 and read as the reader reads dates.
    // An ISO date printed into the sentence sits beside a formatted timestamp
    // on the same row, and in French "pour le 2026-09-14" is not French.
    const english = withMessages(<ActivityPanel rows={[refreshed]} />);
    expect(
      screen.getByText(
        en.audit.dataRefreshed
          .replace("{day}", "Sep 14, 2026")
          .replace("{previousDay}", "Sep 13, 2026"),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-14/)).not.toBeInTheDocument();

    english.unmount();
    inFrench(<ActivityPanel rows={[refreshed]} />);
    expect(
      screen.getByText(
        fr.audit.dataRefreshed
          .replace("{day}", "14 sept. 2026")
          .replace("{previousDay}", "13 sept. 2026"),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-14/)).not.toBeInTheDocument();
  });

  it("names the application for an entry nobody wrote", () => {
    // The other half of the line above. An entry the application wrote is not
    // an entry whose author could not be read: a rebuild of the records is
    // nobody's doing, and calling it unattributed would make it look like
    // somebody's, untraceably.
    withMessages(<ActivityPanel rows={[row({ actor: { kind: "system" } })]} />);

    expect(
      screen.getByText(new RegExp(en.dashboard.activity.systemActor)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(en.dashboard.activity.unknownActor)),
    ).not.toBeInTheDocument();
  });

  it("states that a change it cannot phrase still happened", () => {
    // A key nothing translates must not render as a raw key, and must not
    // render as nothing at all: the change did happen, and the trail says so.
    withMessages(
      <ActivityPanel
        rows={[
          row({ event: event({ summaryKey: "audit.notInTheCatalogue" }) }),
        ]}
      />,
    );

    expect(
      screen.getByText(en.dashboard.activity.unreadableChange),
    ).toBeInTheDocument();
    expect(screen.queryByText(/notInTheCatalogue/)).not.toBeInTheDocument();
  });

  it("does the same when the sentence would have a hole in it", () => {
    withMessages(
      <ActivityPanel
        rows={[
          row({
            event: event({
              summaryParams: { status: "completed" },
            }),
          }),
        ]}
      />,
    );

    expect(
      screen.getByText(en.dashboard.activity.unreadableChange),
    ).toBeInTheDocument();
  });

  it("is rendering the sentences it claims to render", () => {
    // The control: without a row that succeeds, every assertion above would be
    // satisfied by a panel that fell back on everything.
    withMessages(
      <ActivityPanel
        rows={[
          row({
            event: event({
              summaryKey: "audit.demoReset",
              summaryParams: {},
              entity: "demo",
            }),
          }),
        ]}
      />,
    );

    expect(screen.getByText(en.audit.demoReset)).toBeInTheDocument();
    expect(
      screen.queryByText(en.dashboard.activity.unreadableChange),
    ).not.toBeInTheDocument();
  });
});

/**
 * An audit key lives in three places — the registry, both catalogues, and a
 * case in `useAuditSummary` — and the third is the one that gets forgotten. The
 * check in `tests/unit/audit-keys.test.ts` covers the first two and cannot see
 * the third: a key registered and translated, with no case rendering it, leaves
 * that check green while the feed says "a change was recorded".
 *
 * These are the only tests that read the sentence off the screen, which is why
 * they run in both languages. An import is the change most worth reading back:
 * it is the one that moved hundreds of records at once.
 */
describe("the activity feed on an import", () => {
  it("says what was imported, and from which file", () => {
    withMessages(<ActivityPanel rows={[row({ event: importEvent() })]} />);

    expect(
      screen.getByText(/240.*mp2-export-sample\.xlsx/),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.dashboard.activity.unreadableChange)).toBe(
      null,
    );
  });

  it("says it in French too", () => {
    inFrench(<ActivityPanel rows={[row({ event: importEvent() })]} />);

    expect(
      screen.getByText(/240.*mp2-export-sample\.xlsx/),
    ).toBeInTheDocument();
    expect(screen.queryByText(fr.dashboard.activity.unreadableChange)).toBe(
      null,
    );
  });

  it("says an import was undone, in both languages", () => {
    const undone = importEvent({
      action: "deleted",
      summaryKey: "audit.importRolledBack",
    });

    withMessages(<ActivityPanel rows={[row({ event: undone })]} />);
    expect(screen.queryByText(en.dashboard.activity.unreadableChange)).toBe(
      null,
    );
    expect(screen.getByText(/mp2-export-sample\.xlsx/)).toBeInTheDocument();

    inFrench(<ActivityPanel rows={[row({ event: undone })]} />);
    expect(screen.queryByText(fr.dashboard.activity.unreadableChange)).toBe(
      null,
    );
  });

  it("would notice a key with no case rendering it", () => {
    // The control, and the whole reason these tests exist. A key that is
    // registered and translated but has no case falls through to the fallback,
    // which is exactly what the audit-keys check cannot see.
    withMessages(
      <ActivityPanel
        rows={[row({ event: importEvent({ summaryKey: "audit.notAKey" }) })]}
      />,
    );

    expect(
      screen.getByText(en.dashboard.activity.unreadableChange),
    ).toBeInTheDocument();
  });
});
