import { describe, expect, it } from "vitest";
import { calendarDate, daysBetweenDays } from "./dates";

describe("calendar days", () => {
  it("keeps a stored day on its own date in the application's zone", () => {
    // The whole reason this function exists. Every screen renders in
    // America/Toronto, so a day parsed at midnight UTC prints as the day
    // before — quietly, on every date in the demo.
    const printed = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(calendarDate("2026-09-12"));

    expect(printed).toBe("2026-09-12");
  });

  it("shows what it is guarding against", () => {
    // The deletion control: the naive parse this replaces, proven wrong in the
    // application's own zone. If this ever starts printing the twelfth, the
    // helper is no longer earning its place.
    const naive = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date("2026-09-12"));

    expect(naive).toBe("2026-09-11");
  });

  it("measures whole days in both directions", () => {
    expect(daysBetweenDays("2026-09-12", "2026-09-19")).toBe(7);
    expect(daysBetweenDays("2026-09-19", "2026-09-12")).toBe(-7);
    expect(daysBetweenDays("2026-09-12", "2026-09-12")).toBe(0);
  });

  it("counts across a daylight-saving change without losing an hour", () => {
    // Toronto moves its clocks on 1 November 2026. Measured in local time this
    // span is 25 hours a day short of two days; measured the way this does it,
    // it is exactly two.
    expect(daysBetweenDays("2026-10-31", "2026-11-02")).toBe(2);
  });
});
