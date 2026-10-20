// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { DashboardPanel } from "./panel";

/**
 * Three states, never two.
 *
 * This is the panel every home screen is built from, so the rule lives or dies
 * here: before the records have been read there is no answer, and a panel that
 * drew "nothing here" in that moment would be telling a reviewer something
 * untrue about their data.
 */

function withMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function panel(rows: readonly string[] | null) {
  return (
    <DashboardPanel
      title="Panel"
      rows={rows}
      emptyIcon={Inbox}
      emptyTitle="Nothing here"
      emptyBody="Nothing has been recorded."
    >
      {(items) => (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

describe("DashboardPanel", () => {
  it("waits, rather than claiming there is nothing, before the records are read", () => {
    withMessages(panel(null));

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(en.states.loading.label)).toBeInTheDocument();
    // The distinction the whole rule rests on.
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
  });

  it("says there is nothing once it knows there is nothing", () => {
    withMessages(panel([]));

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("draws the rows when there are rows", () => {
    withMessages(panel(["WO-2026-0001", "WO-2026-0002"]));

    expect(screen.getByText("WO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("WO-2026-0002")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("tells the three states apart rather than folding two of them together", () => {
    // The control: an empty array and a null are different values arriving at
    // the same prop, and this is the assertion that they leave different marks
    // on the screen. Collapse the two in `panel.tsx` and this is what fails.
    const unknown = render(
      <NextIntlClientProvider
        locale="en-CA"
        messages={en}
        timeZone="America/Toronto"
      >
        {panel(null)}
      </NextIntlClientProvider>,
    );
    const unknownMarkup = unknown.container.innerHTML;
    unknown.unmount();

    const empty = render(
      <NextIntlClientProvider
        locale="en-CA"
        messages={en}
        timeZone="America/Toronto"
      >
        {panel([])}
      </NextIntlClientProvider>,
    );

    expect(empty.container.innerHTML).not.toBe(unknownMarkup);
  });
});
