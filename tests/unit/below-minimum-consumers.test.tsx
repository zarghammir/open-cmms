// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { formats } from "@/i18n/formats";
import { AssetParts } from "@/components/assets/asset-parts";
import { buildSeed, type DemoData } from "@/data/seed";
import { createPartRepository } from "@/data/repositories/part";
import { dashboardKpis } from "@/data/selectors/kpi";
import { isBelowMinimum } from "@/domain/constants/part";
import type { Part } from "@/domain/types";
import type { RepositoryContext } from "@/data/repositories/types";

/**
 * Every consumer of "below its minimum" asks the same question of the same
 * part, and gets the same answer.
 *
 * The rule was written out four times on `main` — the dashboard KPI, the asset
 * page's parts panel, the seed that decides which parts get a low-stock notice,
 * and the part repository — and none of them called another. They agreed only
 * because each happened to use a strict `<`.
 *
 * **Everything here is planted at exactly the minimum on purpose.** Under `<`
 * such a part is not below it; under `<=` it is. Every other quantity answers
 * the same under both rules, so no other input can tell which one is in force,
 * and a test using any of them would pass whichever rule the code held.
 *
 * That also rules out the version of this file that would have been easier to
 * write: computing each expected answer by calling `isBelowMinimum` and
 * comparing it to what the consumer said. Flipping the predicate would move
 * both sides of every such assertion and leave the file green — a control that
 * reports the absence of its own sensitivity as safety.
 */

/*
 * The localised `Link` only, stubbed.
 *
 * `AssetParts` links each row to the inventory screen, and `@/i18n/navigation`
 * reaches `next/navigation`, which does not resolve outside a Next runtime.
 * What is under test here is which chip the row draws, not where it points, so
 * the seam is the router and nothing else — the component, its translations and
 * its call to `isBelowMinimum` are all real.
 */
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const NOW = new Date("2026-09-12T00:00:00.000Z");
const TODAY = "2026-09-12";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      formats={formats}
      timeZone="America/Toronto"
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** One part sitting exactly on its minimum, and one a single unit under it. */
function planted(seed: DemoData) {
  const base = seed.parts[0]!;
  const atMinimum: Part = {
    ...base,
    id: "prt-at-minimum",
    partNumber: "EQL-0001",
    quantityOnHand: 4,
    reorderPoint: 4,
  };
  const oneUnder: Part = {
    ...atMinimum,
    id: "prt-one-under",
    partNumber: "LOW-0001",
    quantityOnHand: 3,
  };
  return { atMinimum, oneUnder };
}

function dataWith(parts: Part[]): DemoData {
  return { ...buildSeed(NOW), parts };
}

describe("a part sitting exactly on its minimum", () => {
  const { atMinimum, oneUnder } = planted(buildSeed(NOW));

  it("is not below it, and one unit under is", () => {
    // The predicate itself, so the consumers below are compared against a
    // stated answer rather than against each other.
    expect(isBelowMinimum(atMinimum)).toBe(false);
    expect(isBelowMinimum(oneUnder)).toBe(true);
  });

  it("is not counted by the dashboard", () => {
    const kpis = dashboardKpis(dataWith([atMinimum, oneUnder]), TODAY);
    expect(kpis.partsBelowMinimum).toBe(1);
  });

  it("is not listed by the repository", () => {
    const data = dataWith([atMinimum, oneUnder]);
    const context: RepositoryContext = {
      get data() {
        return data;
      },
      commit: () => undefined,
      commitMany: () => undefined,
      now: () => NOW,
    };
    const low = createPartRepository(context).belowMinimum();

    expect(low.map((part) => part.id)).toEqual(["prt-one-under"]);
  });

  it("is drawn as in stock on the asset page, and the one under is not", () => {
    render(<AssetParts parts={[atMinimum, oneUnder]} />, { wrapper });

    // Both chips are drawn, one of each, which is the outcome a reader sees.
    expect(screen.getAllByText(en.assetDetail.parts.ok)).toHaveLength(1);
    expect(screen.getAllByText(en.assetDetail.parts.low)).toHaveLength(1);
  });

  it("gets no seeded low-stock notice, and every one that exists is earned", () => {
    /*
     * The seed cannot be handed a planted part — it builds its own — so this
     * asks the question the other way round: every `partBelowMinimum` notice in
     * the seed belongs to a part the predicate calls low, and every part it
     * calls low has one. A seed filtering on its own copy of the rule could
     * satisfy the first half and fail the second.
     */
    const seed = buildSeed(NOW);
    const noticed = new Set(
      seed.notifications
        .filter((one) => one.kind === "partBelowMinimum")
        .map((one) => one.subject.id),
    );
    const low = seed.parts.filter((part) => isBelowMinimum(part));

    expect(low.length, "the seed holds no low part to check").toBeGreaterThan(
      0,
    );
    expect(noticed.size).toBe(low.length);
    expect(low.every((part) => noticed.has(part.id))).toBe(true);
  });
});
