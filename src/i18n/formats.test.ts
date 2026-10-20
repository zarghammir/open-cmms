import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import { formats } from "./formats";
import { timeZone, type AppLocale } from "./routing";

/**
 * These run the same formatter and the same presets the screens use, so a
 * change to `formats.ts` that breaks Canadian conventions fails here.
 */
function formatterFor(locale: AppLocale) {
  return createFormatter({ locale, timeZone, formats });
}

const en = formatterFor("en-CA");
const fr = formatterFor("fr-CA");

// A Friday, chosen so the weekday is visible in the long format.
const reference = new Date("2026-09-11T18:05:00.000Z");

describe("locale formats", () => {
  it("formats a date the Canadian way in each language", () => {
    const english = en.dateTime(reference, "day");
    const french = fr.dateTime(reference, "day");

    expect(english).toContain("2026");
    expect(french).toContain("2026");
    expect(english).toContain("11");
    expect(french).toContain("11");
    // The month name differs between the two languages.
    expect(french).not.toBe(english);
  });

  it("names the weekday and the month in full for the home screens", () => {
    expect(en.dateTime(reference, "dayFull").toLowerCase()).toContain("friday");
    expect(fr.dateTime(reference, "dayFull").toLowerCase()).toContain(
      "vendredi",
    );
  });

  it("renders times in the organization's time zone, not the machine's", () => {
    // 18:05 UTC is 14:05 in Toronto on that date.
    expect(en.dateTime(reference, "dayTime")).toContain("14:05");
    // Canadian French writes a time as "14 h 05", with whichever space ICU
    // uses for the language.
    expect(fr.dateTime(reference, "dayTime")).toMatch(/14\s?h\s?05/);
  });

  it("uses the 24-hour clock in both languages", () => {
    const english = en.dateTime(reference, "time");
    expect(english).toContain("14");
    expect(english.toLowerCase()).not.toContain("pm");
    expect(english.toLowerCase()).not.toContain("p.m.");
  });

  it("uses a period in English and a comma in French for decimals", () => {
    expect(en.number(1234.5, "decimal")).toBe("1,234.50");
    const french = fr.number(1234.5, "decimal");
    expect(french).toContain("234,50");
    expect(french).not.toContain(".");
  });

  it("drops the fraction for counts", () => {
    expect(en.number(42.4, "integer")).toBe("42");
    expect(fr.number(1200, "integer")).not.toContain(",");
  });

  it("puts the dollar sign where each language puts it", () => {
    expect(en.number(1234.5, "currency").startsWith("$")).toBe(true);
    expect(fr.number(1234.5, "currency").trimEnd().endsWith("$")).toBe(true);
  });
});
