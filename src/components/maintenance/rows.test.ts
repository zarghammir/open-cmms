import { describe, expect, it } from "vitest";
import {
  matchesPlanSearch,
  matchesScheduleSearch,
  monthOf,
  readDue,
  shiftMonth,
  startOfWeek,
  weeksInMonth,
  type PlanRow,
  type ScheduleRow,
} from "./rows";

const schedule: ScheduleRow = {
  id: "sch-AHU-Q-AHU-KGN-11",
  assetId: "ast-AHU-KGN-11",
  assetTag: "AHU-KGN-11",
  assetName: "Air handling unit AHU-KGN-11",
  planId: "pln-AHU-Q",
  planName: "Air handling unit, quarterly service",
  frequency: "quarterly",
  frequencyLabel: "Quarterly",
  nextDueOn: "2026-09-20",
  due: { kind: "ahead", days: 8 },
  lastCompletedOn: "2026-06-21",
  facilityId: "fac-KGN",
  facilityCity: "Kingston",
  facilityName: "Kingston Central Laboratory",
  openOrderNumber: null,
};

const plan: PlanRow = {
  id: "pln-AHU-Q",
  code: "AHU-Q",
  name: "Air handling unit, quarterly service",
  assetTypeLabel: "Air handling unit",
  frequency: "quarterly",
  frequencyLabel: "Quarterly",
  leadTimeDays: 14,
  estimatedMinutes: 120,
  scheduleCount: 5,
  active: true,
};

describe("searching the schedules", () => {
  it("matches the tag, the asset and the plan", () => {
    expect(matchesScheduleSearch(schedule, "AHU-KGN-11")).toBe(true);
    expect(matchesScheduleSearch(schedule, "air handling")).toBe(true);
    expect(matchesScheduleSearch(schedule, "quarterly service")).toBe(true);
  });

  it("does not match a field with a facet of its own", () => {
    /*
     * Returning rows that do not contain what was typed reads as broken.
     *
     * The site is easy to test: "Kingston" appears only in the facility fields.
     * The frequency is not — the first version of this asserted that searching
     * "Quarterly" misses, and it does not, because this plan is *named* "…,
     * quarterly service". That was the test being wrong rather than the search:
     * a row whose name contains the word should match on the name. So the
     * frequency is isolated by giving the row a label its name does not carry.
     */
    expect(matchesScheduleSearch(schedule, "Kingston")).toBe(false);
    expect(
      matchesScheduleSearch(
        { ...schedule, frequencyLabel: "Annual" },
        "Annual",
      ),
    ).toBe(false);
    // And the positive beside it, so this is not passing because nothing ever
    // matches: the same word in the plan name does match.
    expect(matchesScheduleSearch(schedule, "quarterly")).toBe(true);
  });

  it("an empty query filters nothing out, and a miss is a miss", () => {
    expect(matchesScheduleSearch(schedule, "   ")).toBe(true);
    expect(matchesScheduleSearch(schedule, "chiller")).toBe(false);
  });
});

describe("searching the plans", () => {
  it("matches the code and the name, and nothing else", () => {
    expect(matchesPlanSearch(plan, "AHU-Q")).toBe(true);
    expect(matchesPlanSearch(plan, "quarterly service")).toBe(true);
    expect(matchesPlanSearch(plan, "Air handling unit")).toBe(true);
  });

  it("an empty query filters nothing out, and a miss is a miss", () => {
    expect(matchesPlanSearch(plan, "")).toBe(true);
    expect(matchesPlanSearch(plan, "boiler")).toBe(false);
  });
});

describe("how far off a visit is", () => {
  const today = "2026-09-12";

  it("counts a date in the past as late, in whole days", () => {
    expect(readDue("2026-09-05", today, 14)).toEqual({ kind: "late", days: 7 });
  });

  it("calls today today rather than nought days", () => {
    // "0 days" is a number a reader has to interpret; "today" is the answer.
    expect(readDue(today, today, 14)).toEqual({ kind: "today" });
  });

  it("separates a visit that can be raised now from one that cannot", () => {
    /*
     * The distinction the column exists for. Inside the lead time an order can
     * be raised; beyond it the row is not actionable, and drawing both the same
     * way would put a button on a screen that refuses it.
     */
    expect(readDue("2026-09-20", today, 14)).toEqual({ kind: "soon", days: 8 });
    expect(readDue("2026-09-20", today, 3)).toEqual({ kind: "ahead", days: 8 });
  });

  it("puts the boundary on the lead-time day itself", () => {
    // A plan with fourteen days' lead time can raise on day fourteen.
    expect(readDue("2026-09-26", today, 14)).toEqual({
      kind: "soon",
      days: 14,
    });
    expect(readDue("2026-09-27", today, 14)).toEqual({
      kind: "ahead",
      days: 15,
    });
  });

  it("would tell the four apart", () => {
    // The control: a reader stuck on one kind would pass whichever assertions
    // happened to want that kind, so all four are named here together.
    const kinds = [
      readDue("2026-09-01", today, 14).kind,
      readDue(today, today, 14).kind,
      readDue("2026-09-15", today, 14).kind,
      readDue("2026-12-15", today, 14).kind,
    ];
    expect(kinds).toEqual(["late", "today", "soon", "ahead"]);
  });
});

describe("grouping a month into weeks", () => {
  const on = (day: string, id = day): ScheduleRow => ({
    ...schedule,
    id,
    nextDueOn: day as ScheduleRow["nextDueOn"],
  });

  it("starts a week on Monday, and walks Sunday back six days", () => {
    /*
     * The off-by-one this function exists to get right. `getUTCDay` is 0 for
     * Sunday, so the naive subtraction leaves Sunday starting its own week —
     * which puts one day in a week of its own and the six before it in another.
     */
    expect(startOfWeek("2026-09-14" as never)).toBe("2026-09-14"); // a Monday
    expect(startOfWeek("2026-09-20" as never)).toBe("2026-09-14"); // the Sunday after
    expect(startOfWeek("2026-09-21" as never)).toBe("2026-09-21"); // next Monday
  });

  it("keeps a visit in the week it falls in, not the week the month starts", () => {
    // 1 September 2026 is a Tuesday, so its week starts in August.
    const weeks = weeksInMonth([on("2026-09-01")], { year: 2026, month: 9 });
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.startsOn).toBe("2026-08-31");
  });

  it("only makes rows for days that have visits", () => {
    // A month is thirty-odd days and a planner's has visits on a handful.
    const weeks = weeksInMonth(
      [on("2026-09-02"), on("2026-09-02", "second"), on("2026-09-15")],
      { year: 2026, month: 9 },
    );
    const days = weeks.flatMap((week) => week.days);
    expect(days.map((day) => day.day)).toEqual(["2026-09-02", "2026-09-15"]);
    // Two visits on one day are one row carrying both.
    expect(days[0]!.rows).toHaveLength(2);
  });

  it("leaves out visits from other months", () => {
    const weeks = weeksInMonth(
      [on("2026-08-31"), on("2026-09-02"), on("2026-10-01")],
      { year: 2026, month: 9 },
    );
    expect(weeks.flatMap((w) => w.days).map((d) => d.day)).toEqual([
      "2026-09-02",
    ]);
  });

  it("orders weeks and days, and says nothing when there is nothing", () => {
    const weeks = weeksInMonth([on("2026-09-28"), on("2026-09-02")], {
      year: 2026,
      month: 9,
    });
    expect(weeks.map((w) => w.startsOn)).toEqual(["2026-08-31", "2026-09-28"]);
    // An empty month is empty, not a month of empty weeks.
    expect(weeksInMonth([], { year: 2026, month: 9 })).toEqual([]);
  });

  it("rolls the year over in both directions", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    // And the ordinary case, so this is not passing only at the edges.
    expect(shiftMonth({ year: 2026, month: 6 }, 1)).toEqual({
      year: 2026,
      month: 7,
    });
    expect(monthOf("2026-09-12" as never)).toEqual({ year: 2026, month: 9 });
  });
});
