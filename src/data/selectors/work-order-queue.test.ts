import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import {
  matchesAssignee,
  matchesWorkOrderSearch,
  type WorkOrderRow,
} from "@/components/work-orders/work-order-rows";
import {
  EMPTY_QUEUE_FILTER,
  filterWorkOrderRows,
  matchesDueWindow,
  toWorkOrderRow,
  workOrderRows,
} from "./work-order-queue";

const TODAY = "2026-09-12";
const seed = buildSeed(new Date(`${TODAY}T00:00:00.000Z`));
const rows = workOrderRows(seed, TODAY, "en-CA");

function row(overrides: Partial<WorkOrderRow>): WorkOrderRow {
  return { ...(rows[0] as WorkOrderRow), ...overrides };
}

function filter(overrides: Partial<typeof EMPTY_QUEUE_FILTER>) {
  return { ...EMPTY_QUEUE_FILTER, ...overrides };
}

describe("the queue's rows", () => {
  it("builds a row for every order, newest request first", () => {
    expect(rows).toHaveLength(seed.workOrders.length);
    expect(rows.length).toBeGreaterThan(10);

    const requested = rows.map((candidate) => candidate.requestedAt);
    expect([...requested].sort().reverse()).toEqual(requested);
  });

  it("reads the record in the language it is asked for", () => {
    const order = seed.workOrders[0]!;
    const english = toWorkOrderRow(seed, order, TODAY, "en-CA");
    const french = toWorkOrderRow(seed, order, TODAY, "fr-CA");

    expect(english.title).toBe(order.title.en);
    expect(french.title).toBe(order.title.fr);
    // Worth asserting rather than assuming: a seed whose two languages matched
    // would make the pair above pass while proving nothing.
    expect(order.title.en).not.toBe(order.title.fr);
  });

  it("keeps what it knows about a row it cannot fully read", () => {
    // A site that does not resolve keeps its id rather than showing a blank
    // column: an empty cell reads as "no site", which is a different claim.
    // Both fields, because the column shows one and names the other: a city
    // that fell back to empty would read as a site with no name.
    const orphan = { ...seed.workOrders[0]!, facilityId: "fac-gone" };
    const unread = toWorkOrderRow(seed, orphan, TODAY, "en-CA");
    expect(unread.facilityName).toBe("fac-gone");
    expect(unread.facilityCity).toBe("fac-gone");
  });

  it("carries the city beside the name, in the reader's language", () => {
    /*
     * The desktop column renders the city and names the full site, so both
     * have to be there and both have to be translated. WA-64: four of the five
     * sites are "Laboratoire régional de …", so truncating the name would have
     * kept the part that distinguishes nothing.
     */
    const order = seed.workOrders[0]!;
    const facility = seed.facilities.find(
      (candidate) => candidate.id === order.facilityId,
    )!;
    const english = toWorkOrderRow(seed, order, TODAY, "en-CA");
    const french = toWorkOrderRow(seed, order, TODAY, "fr-CA");

    expect(english.facilityCity).toBe(facility.city.en);
    expect(french.facilityCity).toBe(facility.city.fr);
    expect(english.facilityName).toBe(facility.name.en);

    // The city is the shorter of the two, which is the whole reason it is the
    // one on screen. Asserted rather than assumed: a seed where they matched
    // would make this change pointless and nothing else here would notice.
    expect(french.facilityCity.length).toBeLessThan(french.facilityName.length);
  });
});

describe("who a row is assigned to", () => {
  const person = row({ assigneeUserId: "usr-1", crewCode: null });
  const crew = row({ assigneeUserId: null, crewCode: "HVAC-1" });
  const nobody = row({ assigneeUserId: null, crewCode: null });

  it("tells nobody, a crew and a person apart", () => {
    // Three answers. Folding the crew case into "unassigned" would tell a
    // coordinator that work somebody is tracking is work nobody has.
    expect(matchesAssignee(nobody, "unassigned")).toBe(true);
    expect(matchesAssignee(crew, "unassigned")).toBe(false);
    expect(matchesAssignee(person, "unassigned")).toBe(false);

    expect(matchesAssignee(crew, "crew")).toBe(true);
    expect(matchesAssignee(nobody, "crew")).toBe(false);
    expect(matchesAssignee(person, "crew")).toBe(false);

    expect(matchesAssignee(person, "usr-1")).toBe(true);
    expect(matchesAssignee(crew, "usr-1")).toBe(false);
  });

  it("shows everything when nobody is asked about", () => {
    for (const candidate of [person, crew, nobody]) {
      expect(matchesAssignee(candidate, "anyone")).toBe(true);
    }
  });

  it("finds the crew-code-only rows the seed holds, at more than one site", () => {
    /*
     * The behaviour, not the count — `tests/unit/seed-integrity.test.ts` states
     * how many the seed holds and that the two broken shapes do not occur.
     * What matters here is that the facet reaches them, because a filter that
     * is correct and matches nothing looks exactly like a filter that is wrong.
     */
    const crew = rows.filter((candidate) => matchesAssignee(candidate, "crew"));
    const unassigned = rows.filter((candidate) =>
      matchesAssignee(candidate, "unassigned"),
    );

    expect(crew.length).toBeGreaterThan(0);
    expect(new Set(crew.map((c) => c.facilityId)).size).toBeGreaterThan(1);
    expect(
      crew.every((c) => c.crewCode !== null && c.assigneeUserId === null),
    ).toBe(true);

    // And the two facets do not overlap: a crew row is not also unassigned.
    expect(
      crew.some((c) => unassigned.some((u) => u.id === c.id)),
      "a crew-code row is being counted as unassigned too",
    ).toBe(false);
    expect(unassigned.length).toBeGreaterThan(0);
  });
});

describe("due windows", () => {
  it("treats no due date as its own answer, not as overdue and not as later", () => {
    const undated = row({ dueOn: null, daysLate: null });

    expect(matchesDueWindow(undated, "none", TODAY)).toBe(true);
    expect(matchesDueWindow(undated, "overdue", TODAY)).toBe(false);
    expect(matchesDueWindow(undated, "today", TODAY)).toBe(false);
    expect(matchesDueWindow(undated, "week", TODAY)).toBe(false);
  });

  it("puts each dated row in the window it belongs to", () => {
    const late = row({ dueOn: "2026-09-01", daysLate: 11 });
    const today = row({ dueOn: TODAY, daysLate: null });
    const soon = row({ dueOn: "2026-09-18", daysLate: null });
    const later = row({ dueOn: "2026-10-05", daysLate: null });

    expect(matchesDueWindow(late, "overdue", TODAY)).toBe(true);
    expect(matchesDueWindow(today, "today", TODAY)).toBe(true);
    expect(matchesDueWindow(soon, "week", TODAY)).toBe(true);
    expect(matchesDueWindow(later, "week", TODAY)).toBe(false);
    expect(matchesDueWindow(later, "month", TODAY)).toBe(true);
    // Late work is not "due this month": it was due, and the window a person
    // reaches for to find it is Overdue.
    expect(matchesDueWindow(late, "month", TODAY)).toBe(false);
  });

  it("agrees with the dashboard about what overdue means", () => {
    // Both come from `isOverdue`. If these two numbers ever differ, one screen
    // is lying and it will be this line that says so.
    const overdueRows = rows.filter((candidate) => candidate.daysLate !== null);
    const overdueOrders = seed.workOrders.filter(
      (order) =>
        order.dueAt !== null &&
        order.dueAt < TODAY &&
        !["completed", "cancelled"].includes(order.status),
    );

    expect(overdueRows).toHaveLength(overdueOrders.length);
    expect(overdueRows.length).toBeGreaterThan(0);
  });
});

describe("narrowing the queue", () => {
  it("shows everything when nothing is chosen", () => {
    // An untouched filter means no opinion, not "nothing matches". A queue that
    // opened empty would be read as a queue with no work in it.
    expect(filterWorkOrderRows(rows, EMPTY_QUEUE_FILTER, TODAY)).toHaveLength(
      rows.length,
    );
  });

  it("narrows on one facet and composes two", () => {
    const open = filterWorkOrderRows(rows, filter({ status: ["open"] }), TODAY);
    const openCritical = filterWorkOrderRows(
      rows,
      filter({ status: ["open"], priority: ["critical"] }),
      TODAY,
    );

    expect(open.length).toBeGreaterThan(0);
    expect(open.every((candidate) => candidate.status === "open")).toBe(true);
    expect(open.length).toBeLessThan(rows.length);

    // The intersection, not either alone.
    expect(openCritical.length).toBeLessThanOrEqual(open.length);
    expect(
      openCritical.every(
        (candidate) =>
          candidate.status === "open" && candidate.priority === "critical",
      ),
    ).toBe(true);
  });

  it("searches the number, the title and the tag, and not the description", () => {
    const target = rows[0]!;

    expect(matchesWorkOrderSearch(target, target.number)).toBe(true);
    expect(matchesWorkOrderSearch(target, target.assetTag)).toBe(true);
    expect(matchesWorkOrderSearch(target, target.title.slice(0, 8))).toBe(true);

    // The deliberate exclusion. A queue that matched body text would return
    // rows nobody was looking for and become impossible to predict.
    const order = seed.workOrders.find(
      (candidate) => candidate.id === target.id,
    )!;
    const wordOnlyInDescription = order.description.en
      .split(" ")
      .find(
        (word) =>
          word.length > 6 &&
          !order.title.en.toLowerCase().includes(word.toLowerCase()),
      );
    expect(wordOnlyInDescription).toBeDefined();
    expect(matchesWorkOrderSearch(target, wordOnlyInDescription!)).toBe(false);
  });

  it("returns nothing when nothing matches, rather than everything", () => {
    const none = filterWorkOrderRows(
      rows,
      filter({ query: "zzzz-no-such-thing" }),
      TODAY,
    );

    expect(none).toHaveLength(0);
    // The control: an empty result is only meaningful if a real query returns
    // rows through the same path.
    expect(
      filterWorkOrderRows(rows, filter({ query: rows[0]!.number }), TODAY)
        .length,
    ).toBeGreaterThan(0);
  });
});
