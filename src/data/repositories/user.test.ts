import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Mutation,
} from "@/stores/mutations";
import { canBeAssignedWork } from "@/data/selectors/assignable";
import { createUserRepository } from "./user";
import type { RepositoryContext } from "./types";

/**
 * Changing a person's record, and the trail saying so.
 *
 * The three claims the ticket makes are three different claims and each is
 * asserted on its own: the record changes, the trail gains one sentence naming
 * who and what, and the person's new role governs what work they may be given.
 * The third is read from the stored record through `canBeAssignedWork` — the
 * function the assignee lists actually call — rather than from a list of roles
 * typed into this file, which would pass while the product disagreed with it.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");
const ACTOR = { userId: "usr-admin", role: "administrator" as const };

function harness(seed: DemoData = buildSeed(NOW)) {
  let data = seed;
  let sequence = 0;
  const applied: Mutation[] = [];

  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      sequence += 1;
      applied.push(mutation);
      data = applyMutation(
        data,
        mutation,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    commitMany(mutations, audit, actor, entityId, at) {
      sequence += 1;
      applied.push(...mutations);
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
    users: createUserRepository(context),
    applied,
    get data() {
      return data;
    },
    /** The person as the records hold them now, not as the caller remembers. */
    stored(id: string) {
      const found = data.users.find((one) => one.id === id);
      if (!found) throw new Error(`no user ${id} in the records`);
      return found;
    },
    entriesFor(id: string) {
      return data.auditEvents.filter(
        (event) => event.entity === "user" && event.entityId === id,
      );
    },
    /**
     * The entry just written. The store puts the newest first
     * (`auditEvents: [event, ...]`), so this is index 0 and not the last —
     * reading it from the end gave a green pair of assertions against the
     * same deactivation sentence twice.
     */
    latestFor(id: string) {
      const found = this.entriesFor(id)[0];
      if (!found) throw new Error(`no trail entry for ${id}`);
      return found;
    },
  };
}

/** A person the screen would actually offer: picked from the records, not named. */
function aTechnician(data: DemoData) {
  const found = data.users.find((one) => one.role === "technician");
  if (!found) throw new Error("the seed holds no technician");
  return found;
}

describe("changing a person's role", () => {
  it("changes the record and says so once in the trail", () => {
    const h = harness();
    const person = aTechnician(h.data);
    const before = h.entriesFor(person.id).length;

    h.users.changeRole(person.id, "auditor", ACTOR);

    expect(h.stored(person.id).role).toBe("auditor");

    expect(h.entriesFor(person.id)).toHaveLength(before + 1);
    const entry = h.latestFor(person.id);
    expect(entry.summaryKey).toBe("audit.userRoleChanged");
    expect(entry.summaryParams).toMatchObject({
      fromRole: "technician",
      toRole: "auditor",
    });
    expect(entry.actorKind === "person" && entry.actorUserId).toBe(
      ACTOR.userId,
    );
    expect(entry.changes).toEqual([
      { field: "role", from: "technician", to: "auditor" },
    ]);
  });

  it("governs what work the person may be given, read from their record", () => {
    const h = harness();
    const person = aTechnician(h.data);

    // The floor. Without it the refusal below could have been true all along.
    expect(canBeAssignedWork(h.stored(person.id))).toBe(true);

    h.users.changeRole(person.id, "auditor", ACTOR);

    expect(canBeAssignedWork(h.stored(person.id))).toBe(false);
  });
});

describe("moving a person to another site", () => {
  it("records the move with the site codes people say out loud", () => {
    const h = harness();
    const person = aTechnician(h.data);
    const elsewhere = h.data.facilities.find(
      (one) => one.id !== person.homeFacilityId,
    )!;

    h.users.changeSite(person.id, elsewhere.id, ACTOR);

    expect(h.stored(person.id).homeFacilityId).toBe(elsewhere.id);

    const entry = h.latestFor(person.id);
    expect(entry.summaryKey).toBe("audit.userSiteChanged");
    expect(entry.summaryParams).toMatchObject({
      fromSite: h.data.facilities.find(
        (one) => one.id === person.homeFacilityId,
      )!.code,
      toSite: elsewhere.code,
    });
  });
});

describe("deactivating and reactivating", () => {
  it("stops the person being offered work, and starts it again", () => {
    const h = harness();
    const person = aTechnician(h.data);

    h.users.setActive(person.id, false, ACTOR);
    expect(h.stored(person.id).active).toBe(false);
    expect(canBeAssignedWork(h.stored(person.id))).toBe(false);
    expect(h.latestFor(person.id).summaryKey).toBe("audit.userDeactivated");

    h.users.setActive(person.id, true, ACTOR);
    expect(h.stored(person.id).active).toBe(true);
    expect(canBeAssignedWork(h.stored(person.id))).toBe(true);
    expect(h.latestFor(person.id).summaryKey).toBe("audit.userReactivated");
  });

  it("tells the two apart rather than writing one sentence for both", () => {
    // The pair above could pass with one key used twice if the second
    // assertion read the first entry. Two distinct keys, stated.
    const h = harness();
    const person = aTechnician(h.data);
    h.users.setActive(person.id, false, ACTOR);
    h.users.setActive(person.id, true, ACTOR);

    const keys = h
      .entriesFor(person.id)
      .slice(0, 2)
      .map((entry) => entry.summaryKey);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("a change that changes nothing", () => {
  it("writes no record and no entry for an act nobody performed", () => {
    const h = harness();
    const person = aTechnician(h.data);
    const before = h.entriesFor(person.id).length;

    h.users.changeRole(person.id, person.role, ACTOR);
    h.users.changeSite(person.id, person.homeFacilityId, ACTOR);
    h.users.setActive(person.id, person.active, ACTOR);

    expect(h.applied).toHaveLength(0);
    expect(h.entriesFor(person.id)).toHaveLength(before);
  });
});

describe("a person the records do not hold", () => {
  it("is refused rather than silently written", () => {
    const h = harness();
    expect(() => h.users.changeRole("usr-nobody", "auditor", ACTOR)).toThrow();
    expect(() => h.users.changeSite("usr-nobody", "fac-1", ACTOR)).toThrow();
    expect(() => h.users.setActive("usr-nobody", false, ACTOR)).toThrow();
  });
});
