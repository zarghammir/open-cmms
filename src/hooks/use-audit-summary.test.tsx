// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { formats } from "@/i18n/formats";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import type { AuditEvent } from "@/domain/types";
import { HANDLED_AUDIT_KEYS, KEY_VALUED_NAMESPACES } from "@/lib/audit-summary";
import type { MutationAudit } from "@/stores/mutations";
import { useAuditSummary } from "./use-audit-summary";

/**
 * Every registered key produces a sentence, not the fallback.
 *
 * `tests/unit/audit-keys.test.ts` proves a written key is registered. Nothing
 * proved a registered key is actually *phrased* — and those are different
 * claims. A key can sit in `HANDLED_AUDIT_KEYS`, pass that test, satisfy the
 * typechecker, and still fall through to "a change was recorded" because its
 * branch was dropped.
 *
 * That is not hypothetical. It nearly happened twice: once when `partAdjusted`
 * arrived while this switch was being extracted out of the dashboard, and again
 * when WA-15's two conflict keys met that extraction in a merge. Both were
 * caught by hand. This is the check that would have caught them.
 */

const FALLBACK = "A change was recorded";

/** Arguments every branch might ask for, so none falls back for want of one. */
const EVERY_ARGUMENT = {
  number: "WO-2026-0001",
  status: "waitingForParts",
  user: "Gagnon",
  tag: "AHU-KGN-11",
  quantity: 2,
  partNumber: "FLT-201",
  from: 4,
  to: 6,
  record: "WO-2026-0001",
  fileName: "assets-2026-09.xlsx",
  records: 212,
  version: 4,
  previousVersion: 3,
  day: "2026-09-14",
  previousDay: "2026-09-13",
  minutes: 90,
  count: 7,
  // The two arguments WA-18's preference sentences take. Real values rather
  // than placeholders: both are rendered straight into the sentence, so a
  // made-up one would still produce a sentence and still pass.
  // The crew code a contractor handover names. A real one from the seed's own
  // table rather than a placeholder: it is rendered straight into the
  // sentence, so a made-up value would still phrase and still pass.
  crew: "CONT01",
  channel: "email",
  kind: "workOrderOverdue",
  // WA-22's export. Every argument any registered key needs lives here, so a
  // key whose sentence needs one the fixture lacks reads as unphrased above —
  // which is how this arrived, correctly.
  /*
   * WA-124. `fromRole` and `toRole` are key-valued like `status`, so they are
   * real roles rather than placeholders: a made-up value would be rendered
   * raw and the sentence would still be a sentence, passing this test while
   * proving nothing about the translation. The sites are codes, which are
   * literals in both languages.
   */
  fromRole: "technician",
  toRole: "maintenanceCoordinator",
  fromSite: "KGN",
  toSite: "MCT",
  report: "inventory",
  rows: 25,
  /*
   * WA-112's rule changes. `fromStatus`, `toStatus` and `slaPriority` are
   * key-valued like `status` — real domain values rather than placeholders,
   * because a made-up one would be rendered raw and the sentence would still
   * be a sentence, passing this test while proving nothing about the
   * translation. They are named apart from the `from`/`to` above on purpose:
   * those two are numbers here, and a shared name would have made one of the
   * two sentences read nonsense while both still "phrased".
   */
  fromStatus: "inProgress",
  toStatus: "completed",
  slaPriority: "critical",
  hours: 4,
  // A real cancellation reason, not a placeholder: it is a key-valued argument
  // like `status`, so a made-up value would be rendered raw and the sentence
  // would still be a sentence — passing this test while proving nothing about
  // the translation.
  reason: "duplicate",
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    // `formats` because the application carries them, through
    // `src/i18n/request.ts`. Without it the day refresh phrased through a
    // MISSING_FORMAT error instead of a date: still a string, so the registry
    // check below counted it as phrased while nobody would ever see it.
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

function event(summaryKey: string): AuditEvent {
  return {
    id: "aud-1",
    organizationId: "org-1",
    at: "2026-09-13T14:05:00.000Z",
    actorKind: "person",
    actorUserId: "usr-1",
    actorRole: "maintenanceCoordinator",
    entity: "workOrder",
    entityId: "wko-1",
    action: "statusChanged",
    summaryKey,
    summaryParams: { ...EVERY_ARGUMENT },
    changes: [],
  };
}

describe("turning an audit entry into a sentence", () => {
  const { result } = renderHook(() => useAuditSummary(FALLBACK), { wrapper });
  const summarise = result.current;

  it("has keys to check", () => {
    // Without this an empty registry would satisfy the loop below.
    expect(HANDLED_AUDIT_KEYS.length).toBeGreaterThan(7);
  });

  /**
   * The registry is complete, not merely correct about what is in it.
   *
   * The test below walks `HANDLED_AUDIT_KEYS` and checks each one phrases, so
   * it is only ever as good as the list. Removing a key from the list makes
   * the loop shorter and everything still passes — measured, by removing
   * `workOrderReassigned` while adding it in WA-88 and watching six tests stay
   * green. A key that a repository writes and the registry omits is exactly
   * the entry a reader would meet as "a change was recorded" with no sentence.
   *
   * The catalogue is the other end of the same fact: every `audit.*` string
   * exists because something emits it. Twenty-one strings, twenty-one
   * registered keys, and this is what keeps that true.
   */
  it("registers every audit sentence the catalogue defines", () => {
    const registered = new Set<string>(HANDLED_AUDIT_KEYS);
    const unregistered = Object.keys(en.audit).filter(
      (key) => !registered.has(key),
    );

    expect(
      unregistered,
      `messages/en.json defines audit.${unregistered.join(", audit.")} but ` +
        "HANDLED_AUDIT_KEYS does not list them, so nothing checks they can be " +
        "phrased and a reader meets the fallback instead of a sentence.",
    ).toEqual([]);
  });

  it("phrases every registered key", () => {
    // Two failure modes, not one. A branch that is missing returns undefined
    // rather than the fallback — the switch simply runs off the end — so a
    // check that only compared against the fallback would miss exactly the
    // case this test exists for. Found by dropping the branches on purpose and
    // watching this pass.
    const unphrased = HANDLED_AUDIT_KEYS.filter((key) => {
      const sentence = summarise(event(`audit.${key}`));
      return (
        typeof sentence !== "string" ||
        sentence.trim() === "" ||
        sentence === FALLBACK
      );
    });

    expect(unphrased).toEqual([]);
  });

  /**
   * No sentence still carries a catalogue key where a word should be.
   *
   * "Phrases every registered key" above cannot see this, and that is the
   * whole reason this exists: a key-valued argument that no branch translates
   * is rendered raw, so the sentence reads "from roles.technician.name to
   * roles.maintenanceCoordinator.name" — still a string, still not the
   * fallback, still green. It reads identically in both languages, which is
   * the half that makes it a defect rather than a wording preference.
   *
   * Two shipped this way. `roles.` in WA-124, found by a browser test reading
   * the trail on the dashboard rather than by anything here. `priority.` in
   * WA-112, which had been on main rendering "Set the priority.critical target
   * to 4 hours" and was found only by sweeping the family the first one
   * belonged to.
   *
   * Asked from the independent end — the namespace list the selector stamps —
   * rather than by listing the arguments this test happens to know about. A
   * new key-valued argument adds a namespace to that list, and this fails
   * until something turns it back into a word.
   */
  it("leaves no catalogue key inside a sentence", () => {
    expect(
      KEY_VALUED_NAMESPACES.length,
      "no namespaces to check, so the sweep below proves nothing",
    ).toBeGreaterThan(3);

    const leaking = HANDLED_AUDIT_KEYS.flatMap((key) => {
      const sentence = summarise(event(`audit.${key}`));
      const found = KEY_VALUED_NAMESPACES.filter((namespace) =>
        sentence.includes(namespace),
      );
      return found.length > 0 ? [`${key}: ${sentence}`] : [];
    });

    expect(
      leaking,
      "these sentences render a catalogue key where a word belongs, so they " +
        "read the same in English and French",
    ).toEqual([]);
  });

  it("phrases a change still waiting exactly as it phrases one recorded", () => {
    // The outbox carries MutationAudit and the trail carries AuditEvent. Both
    // hold a catalogue key and its arguments, and the screen listing what has
    // not been sent has to say the same thing the trail will say once it has.
    // Two sentences for one change is two places for it to drift, and the
    // queue is where a technician decides whether to do the work again.
    const queued: MutationAudit = {
      entity: "workOrder",
      action: "created",
      summaryKey: "audit.workOrderCreated",
      summaryParams: { number: "WO-2026-0041" },
    };
    const recorded: AuditEvent = {
      ...event("audit.workOrderCreated"),
      summaryParams: queued.summaryParams,
    };

    // The anchor first: without it two fallbacks would be equal to each other
    // and this would pass on a hook that phrased nothing at all.
    expect(summarise(queued)).toBe("Raised work order WO-2026-0041");
    expect(summarise(queued)).toBe(summarise(recorded));
  });

  it("says the fallback for a key nothing handles", () => {
    // The deletion control. Without it, a `summarise` that returned any
    // non-empty string would pass the assertion above.
    expect(summarise(event("audit.nobodyTranslatedThis"))).toBe(FALLBACK);
  });

  it("says the fallback when an argument the sentence needs is missing", () => {
    // A sentence with a hole in it is worse than an honest refusal, and this is
    // the guard that chooses the refusal.
    const withoutNumber = {
      ...event("audit.statusChanged"),
      summaryParams: { status: "waitingForParts" },
    };

    expect(summarise(withoutNumber)).toBe(FALLBACK);
  });

  it("names the record in a conflict resolution", () => {
    expect(summarise(event("audit.conflictKeptMine"))).toContain(
      "WO-2026-0001",
    );
    expect(summarise(event("audit.conflictKeptTheirs"))).toContain(
      "WO-2026-0001",
    );
  });
});
