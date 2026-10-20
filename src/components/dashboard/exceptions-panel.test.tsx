// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import type { WorkRow } from "@/data/selectors/dashboard";
import { formats } from "@/i18n/formats";
import { ExceptionsPanel } from "./exceptions-panel";

/*
 * A row is a locale-aware `Link`, and next-intl's navigation module reaches
 * `next/navigation`, which does not resolve under the test runner. The stub is
 * an anchor.
 *
 * What it costs is worth naming: this file no longer proves where a row links
 * to. It was never the thing being proved here — the browser suite opens an
 * order from the queue, the asset page and the dashboard and asserts the
 * destination heading each time. What is proved below is that rows render at
 * all, which is the half that makes "no rows" mean something.
 */
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: ReactNode; href: unknown }) => (
    <a {...rest} href="#">
      {children}
    </a>
  ),
}));

/**
 * The panel with nothing in it.
 *
 * This state had no test and could not get one from a browser: every site in
 * the seed has something wrong, which is deliberate — a demonstration opening
 * on an empty "needs attention" panel would be a demonstration of nothing. The
 * browser spec that tried skipped itself on every run and therefore asserted
 * nothing at all, while reading in a list of tests as though it had.
 *
 * A component test does not have that problem: the empty array is handed over
 * directly rather than waited for.
 *
 * The providers carry `formats` because the application does, through
 * `src/i18n/request.ts` — the note in `activity-panel.test.tsx` explains what
 * omitting them renders instead.
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

describe("ExceptionsPanel with nothing to show", () => {
  it("says nothing is late and nothing is critical, in words", () => {
    withMessages(<ExceptionsPanel rows={[]} />);

    expect(
      screen.getByText(en.dashboard.exceptions.emptyTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.dashboard.exceptions.emptyBody),
    ).toBeInTheDocument();
  });

  it("says it in French", () => {
    inFrench(<ExceptionsPanel rows={[]} />);

    expect(
      screen.getByText(fr.dashboard.exceptions.emptyTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fr.dashboard.exceptions.emptyBody),
    ).toBeInTheDocument();
  });

  it("keeps its own heading, so the panel is still identifiable", () => {
    // An empty panel that also loses its title is a card a reader cannot place.
    // The title is what says which question came back with no answer.
    withMessages(<ExceptionsPanel rows={[]} />);

    expect(screen.getByText(en.dashboard.exceptions.title)).toBeInTheDocument();
  });

  it("draws no rows, which is what makes the sentence above the answer", () => {
    withMessages(<ExceptionsPanel rows={[]} />);

    expect(screen.queryByTestId("exception-rows")).not.toBeInTheDocument();
  });
});

describe("ExceptionsPanel telling its three states apart", () => {
  /*
   * Empty is not unknown, and without this the test above cannot tell you which
   * one it saw. `rows === null` is the moment before the browser has read the
   * records back: there are no rows **and no answer**, and a panel that said
   * "nothing late, nothing critical" then would be making a claim about records
   * it has not looked at.
   */
  it("draws a skeleton before the records have been read, not the empty state", () => {
    withMessages(<ExceptionsPanel rows={null} />);

    expect(
      screen.queryByText(en.dashboard.exceptions.emptyTitle),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("exception-rows")).not.toBeInTheDocument();
  });

  it("draws the rows when there are rows, and not the empty state", () => {
    // The positive half. Without it, a panel that rendered nothing at all would
    // satisfy every assertion above about what is absent.
    withMessages(<ExceptionsPanel rows={[workRow()]} />);

    expect(screen.getByTestId("exception-rows")).toBeInTheDocument();
    expect(screen.getByText(/WO-2026-0001/)).toBeInTheDocument();
    expect(
      screen.queryByText(en.dashboard.exceptions.emptyTitle),
    ).not.toBeInTheDocument();
  });
});

function workRow(overrides: Partial<WorkRow> = {}): WorkRow {
  return {
    id: "wko-1",
    number: "WO-2026-0001",
    title: { en: "Replace the supply fan belt", fr: "Remplacer la courroie" },
    status: "open",
    priority: "critical",
    assetId: "ast-1",
    assetTag: "AHU-KGN-01",
    facilityId: "fac-KGN",
    facilityName: {
      en: "Kingston Central Laboratory",
      fr: "Laboratoire central d\u2019Kingston",
    },
    dueOn: "2026-09-10",
    daysLate: 2,
    ...overrides,
  };
}
