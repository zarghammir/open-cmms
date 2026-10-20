// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { NotificationsMenu } from "./notifications-menu";

function renderWithMessages(ui: ReactNode) {
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

describe("NotificationsMenu", () => {
  it("says there is nothing unread when the count is zero, and shows no badge", () => {
    const { container } = renderWithMessages(<NotificationsMenu />);

    expect(
      screen.getByRole("button", {
        name: `${en.shell.notifications.label}: No unread notifications`,
      }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("shows the count on the bell and in its accessible name", () => {
    renderWithMessages(<NotificationsMenu count={3} />);

    expect(
      screen.getByRole("button", {
        name: `${en.shell.notifications.label}: 3 unread notifications`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("uses the singular form for one", () => {
    renderWithMessages(<NotificationsMenu count={1} />);

    expect(
      screen.getByRole("button", {
        name: `${en.shell.notifications.label}: 1 unread notification`,
      }),
    ).toBeInTheDocument();
  });

  it("caps the badge so a large count cannot stretch the header", () => {
    renderWithMessages(<NotificationsMenu count={150} />);

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `${en.shell.notifications.label}: 150 unread notifications`,
      }),
    ).toBeInTheDocument();
  });
});
