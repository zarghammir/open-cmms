import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { ROLES } from "@/domain/constants/roles";
import { peopleByRole, peopleList } from "./people";

/**
 * The people list, and the two answers it must not collapse.
 *
 * A site that does not resolve is not a person with no site, and a role nobody
 * holds is not a role that does not exist. Both are the same mistake in
 * different clothes — an absence read as a fact — and both are things a screen
 * would state confidently and wrongly.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

/** The seed with one person's site pointed at a record that is not there. */
function withUnreadableSite(data: DemoData, index = 0): DemoData {
  return {
    ...data,
    users: data.users.map((user, at) =>
      at === index ? { ...user, homeFacilityId: "wa_not_a_facility" } : user,
    ),
  };
}

describe("the people list", () => {
  const data = buildSeed(TODAY);

  it("has a row per person, each one beside a site that resolves", () => {
    const rows = peopleList(data);

    /*
     * The floors, and the positive the next test needs beside it. If no site
     * resolved at all, "null means unreadable" would be true of every row and
     * the assertion below it would pass on a selector that had simply stopped
     * looking.
     */
    expect(rows).toHaveLength(data.users.length);
    expect(rows.length, "people in the seed").toBeGreaterThan(5);
    expect(
      rows.filter((row) => row.facility === null),
      "seeded people whose site does not resolve",
    ).toEqual([]);

    for (const row of rows) {
      expect(row.facility?.id, row.user.email).toBe(row.user.homeFacilityId);
    }
  });

  it("says unreadable rather than guessing, for that person only", () => {
    const rows = peopleList(withUnreadableSite(data));

    expect(rows[0]!.facility, "a site that is not there").toBeNull();

    /*
     * And only that one. A selector that broke its lookup entirely would
     * satisfy the line above perfectly well, which is the whole reason this
     * second assertion is here rather than a comment saying it is obvious.
     */
    expect(
      rows.slice(1).filter((row) => row.facility === null),
      "everybody else still resolves",
    ).toEqual([]);
  });

  it("marks the role that may change nothing, and only that one", () => {
    const rows = peopleList(data);
    const auditors = rows.filter((row) => row.user.role === "auditor");
    const others = rows.filter((row) => row.user.role !== "auditor");

    // From the ticket's sentence — "Auditor: reads everything" — rather than
    // from `ROLE_CAPABILITIES`, so this can disagree with the code.
    expect(auditors.length, "auditors in the seed").toBeGreaterThan(0);
    expect(
      auditors.every((row) => row.readsOnly),
      "every auditor reads only",
    ).toBe(true);
    expect(
      others.some((row) => row.readsOnly),
      "somebody who is not an auditor reads only",
    ).toBe(false);
  });
});

describe("people grouped by role", () => {
  const data = buildSeed(TODAY);

  it("draws every role in the order the role table uses", () => {
    const groups = peopleByRole(data);

    expect(groups.map((group) => group.role)).toEqual([...ROLES]);
  });

  it("keeps a role nobody holds, rather than dropping the column", () => {
    /*
     * The control, and the reason this selector exists rather than a
     * `groupBy`. Take every auditor out of the organisation: the auditor group
     * must still be there and must be empty. A grouping built from the people
     * — which is the obvious way to write this — returns five groups here, and
     * the screen then says the application has no auditor role at all.
     */
    const withoutAuditors: DemoData = {
      ...data,
      users: data.users.filter((user) => user.role !== "auditor"),
    };

    const groups = peopleByRole(withoutAuditors);
    const auditor = groups.find((group) => group.role === "auditor");

    expect(groups).toHaveLength(ROLES.length);
    expect(auditor, "the auditor group").toBeDefined();
    expect(auditor!.people, "auditors, with none employed").toEqual([]);
    expect(auditor!.readsOnly, "what the seat may do is not who fills it").toBe(
      true,
    );
  });

  it("loses nobody and counts nobody twice", () => {
    const groups = peopleByRole(data);
    const grouped = groups.flatMap((group) =>
      group.people.map((person) => person.user.id),
    );

    expect(grouped.length, "people across every group").toBe(data.users.length);
    expect(new Set(grouped).size, "distinct people").toBe(data.users.length);
  });
});
