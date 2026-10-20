// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import {
  WORK_ORDER_PRIORITY_PRESENTATION,
  WORK_ORDER_STATUS_PRESENTATION,
} from "@/domain/constants/work-order-status";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
} from "@/domain/types/work-order";
import { WorkOrderPriorityChip, WorkOrderStatusChip } from "./work-order-chips";

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

describe("work-order chips", () => {
  it("draws every status with its label and an icon", () => {
    for (const status of WORK_ORDER_STATUSES) {
      const { unmount } = withMessages(<WorkOrderStatusChip status={status} />);

      const chip = screen.getByText(en.workOrderStatus[status]);
      expect(chip).toBeInTheDocument();
      // Colour is never the only signal: the chip carries an icon as well.
      expect(
        chip.closest("[data-slot='status-chip']")?.querySelector("svg"),
      ).not.toBeNull();
      unmount();
    }
  });

  it("draws every priority with its label", () => {
    for (const priority of WORK_ORDER_PRIORITIES) {
      const { unmount } = withMessages(
        <WorkOrderPriorityChip priority={priority} />,
      );
      expect(screen.getByText(en.priority[priority])).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the presentation map and the namespace these chips read in step", () => {
    // The chips look the label up in the `workOrderStatus` and `priority`
    // namespaces; the presentation map names the same keys in full. Nothing
    // makes the two agree at run time, so it is asserted here — repointing one
    // without the other is the way a status quietly starts reading wrong.
    for (const status of WORK_ORDER_STATUSES) {
      expect(WORK_ORDER_STATUS_PRESENTATION[status].labelKey).toBe(
        `workOrderStatus.${status}`,
      );
    }
    for (const priority of WORK_ORDER_PRIORITIES) {
      expect(WORK_ORDER_PRIORITY_PRESENTATION[priority].labelKey).toBe(
        `priority.${priority}`,
      );
    }
  });

  it("is checking a real set of statuses", () => {
    // Without this the loops above would pass while iterating nothing.
    expect(WORK_ORDER_STATUSES.length).toBe(6);
    expect(WORK_ORDER_PRIORITIES.length).toBe(4);
  });
});
