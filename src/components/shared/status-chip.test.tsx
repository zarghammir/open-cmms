// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatusChip } from "./status-chip";

describe("StatusChip", () => {
  it("shows the label as text, so colour is never the only signal", () => {
    render(<StatusChip tone="critical" label="Overdue" icon={Wrench} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows an icon alongside the label", () => {
    const { container } = render(
      <StatusChip tone="positive" label="Completed" icon={Wrench} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("carries the tone as data rather than as the only difference", () => {
    const { container } = render(
      <StatusChip tone="waiting" label="Waiting for parts" icon={Wrench} />,
    );
    const chip = container.querySelector('[data-slot="status-chip"]');
    expect(chip?.getAttribute("data-tone")).toBe("waiting");
    expect(chip?.textContent).toContain("Waiting for parts");
  });

  it("hides the icon from assistive technology because the label carries it", () => {
    const { container } = render(
      <StatusChip tone="neutral" label="Open" icon={Wrench} />,
    );
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
