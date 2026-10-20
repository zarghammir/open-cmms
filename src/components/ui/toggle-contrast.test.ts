import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The pressed state of a toggle is identifiable by sight.
 *
 * WCAG 2.1 **1.4.11 Non-text Contrast** asks for 3:1 for the visual cue that
 * identifies a component's state. Before WA-113 the only such cue was
 * `data-[state=on]:bg-muted` — 1.15:1 against the card the header sits on and
 * 1.06:1 against the page — so which language you were reading in, which
 * report was open and whether you were looking at the Map or the List were
 * carried to assistive technology and to nobody else.
 *
 * **Axe cannot replace this test.** Its `color-contrast` rule is 1.4.3, which
 * is about text against its own background; a pressed item's *text* was always
 * fine. The suite's zero violations was silence, not clearance, which is why
 * this reads the tokens and does the arithmetic itself.
 *
 * It reads the component's own class string rather than a number written here,
 * so reverting the variant reds it by name. A test holding its own copy of
 * "the pressed state is primary" would agree with itself after the revert.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");
/**
 * The component's code, with its comments removed.
 *
 * Read the file whole and this test fails against a correct component: the
 * docblock in `toggle.tsx` quotes the rule this ticket replaced —
 * `data-[state=on]:bg-muted` — and a regex looking for the pressed background
 * found the sentence about the defect instead of the fix. A detector that
 * reads source has to read the code; prose in the same file is describing the
 * past as often as the present.
 */
const TOGGLE = readFileSync("src/components/ui/toggle.tsx", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

/** Every `--token: #hex;` inside the one theme block this application has. */
function tokens(): Record<string, string> {
  const root = CSS.slice(CSS.indexOf(":root {"));
  const found: Record<string, string> = {};
  for (const [, name, hex] of root.matchAll(
    /--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi,
  )) {
    found[name] = hex.toLowerCase();
  }
  return found;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
}

/** The token a pressed item paints itself with, read from the component. */
function pressedToken(property: "bg" | "text"): string {
  const match = TOGGLE.match(
    new RegExp(`data-\\[state=on\\]:${property}-([a-z-]+)`),
  );
  if (!match) {
    throw new Error(
      `toggle.tsx declares no pressed ${property} — the state has no visual cue at all`,
    );
  }
  return match[1]!;
}

describe("a pressed toggle, against what surrounds it", () => {
  const palette = tokens();

  it("reads the tokens and the component, so neither can drift alone", () => {
    /*
     * The floor. Every ratio below is computed from these two files; if the
     * parse came back empty, or the regex stopped matching, the assertions
     * would be comparing undefined against undefined and passing.
     */
    expect(Object.keys(palette).length).toBeGreaterThan(20);
    for (const name of ["card", "background", "muted", "primary"]) {
      expect(palette[name], `--${name} is not a hex token`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
    expect(pressedToken("bg")).toBeTruthy();
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("is at least 3:1 against every surface it is drawn on", () => {
    const fill = palette[pressedToken("bg")];
    expect(
      fill,
      "the pressed background names a token that does not exist",
    ).toBeDefined();

    /*
     * Three surfaces, because the five call sites do not all sit on one. The
     * header and the edit dialog are on `--card`; Map | List and the reports
     * selector are on the page. `--muted` is the third: it is what an
     * unpressed neighbour turns when the pointer is over it, and a pressed
     * item has to stay distinguishable from that too.
     */
    const surfaces = ["card", "background", "muted"] as const;
    const failures = surfaces
      .map((name) => ({ name, ratio: contrast(fill!, palette[name]!) }))
      .filter(({ ratio }) => ratio < 3)
      .map(({ name, ratio }) => `${name}: ${ratio.toFixed(2)}:1`);

    expect(
      failures,
      "1.4.11 asks for 3:1 for the cue that identifies a component's state",
    ).toEqual([]);
  });

  it("keeps its label readable on the fill", () => {
    // 1.4.3, the criterion axe does cover — asserted here because changing the
    // fill without the text colour would trade one failure for another.
    const fill = palette[pressedToken("bg")]!;
    const label = palette[pressedToken("text")]!;
    expect(contrast(label, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it("no longer paints the pressed state with the tint at all", () => {
    // Not only "the fill is dark enough": the rule that was there must be gone
    // from the code, or a second rule could quietly win by source order.
    expect(TOGGLE).not.toMatch(/data-\[state=on\]:bg-muted/);
    expect(TOGGLE).not.toMatch(/aria-pressed:bg-muted/);
  });

  it("would notice the tint this ticket replaced", () => {
    /*
     * The control, written down rather than run once: the value that was
     * there before fails the assertion above, so the test is not passing for
     * any fill at all. `--muted` is what `data-[state=on]:bg-muted` painted.
     */
    expect(contrast(palette.muted!, palette.card!)).toBeLessThan(3);
    expect(contrast(palette.muted!, palette.background!)).toBeLessThan(3);
  });

  it("has one theme, and says so rather than assuming it", () => {
    /*
     * Phase 1 is light only — the same reason `sonner.tsx` is pinned — so the
     * ratios above are the whole answer today. A `.dark` block would bring a
     * second set of surfaces that nothing here measures, so its arrival reds
     * this and whoever adds it extends the check.
     */
    expect(CSS).not.toMatch(/^\.dark\b/m);
    expect(CSS.match(/:root\s*{/g)).toHaveLength(1);
  });
});
