// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { isTerminal } from "@/domain/constants/work-order-status";
import { fullName } from "@/domain/types/user";
import { formats } from "@/i18n/formats";
import { useDemoStore } from "@/stores/demo-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CreateWorkOrderForm } from "@/components/work-orders/create-work-order-form";
import { WorkOrderActions } from "@/components/work-orders/work-order-actions";

/**
 * Neither assignee list offers a person who cannot do the work.
 *
 * The create form offered everybody — including the auditor, the one role that
 * may not change anything — so a coordinator could hand work to somebody who
 * could never finish it, and the trail would have recorded it as done on
 * purpose. The assign dialog filtered out the current holder and nothing else,
 * so it offered the auditor too.
 *
 * **Both surfaces, in one file, from the real store.** The defect is that two
 * screens answered the same question differently, so a test that covered one
 * of them would be the same mistake in a test: the create form's own suite was
 * green throughout. The store is seeded and the components are rendered
 * unmocked, because what is being checked is what a person sees in the select,
 * not what a helper returns.
 *
 * **It lives in `tests/unit` rather than beside the components.** The data
 * boundary forbids anything under `src/components` from importing the seed or
 * the store, and it reads test files too — correctly, since a component that
 * reached the store would be a real breach and a test file is no exception to a
 * rule about what that directory may contain. A store-backed render belongs to
 * no single file anyway, which is what `tests/unit` is for.
 */

const DAY = new Date("2026-09-12T12:00:00.000Z");
const records = buildSeed(DAY);

const AUDITOR = records.users.find((user) => user.role === "auditor")!;
/*
 * The inspector is offered, deliberately: `assign-order.spec.ts` hands an order
 * to one and asserts it arrives on their list, so the product intends them to
 * hold work. They are asserted present here for the same reason the technicians
 * are — a filter that took too much would pass every absence check below.
 */
const INSPECTOR = records.users.find((user) => user.role === "inspector")!;
const TECHNICIANS = records.users.filter((user) => user.role === "technician");
const COORDINATORS = records.users.filter(
  (user) => user.role === "maintenanceCoordinator",
);

/**
 * An order still open enough to be handed to somebody, and held by no person.
 *
 * The dialog deliberately leaves out whoever already holds the order — handing
 * work to the person who has it is not a change — so an order with a
 * technician on it would make "every technician is offered" fail for a correct
 * reason, and the next person would go looking for the wrong defect. Picking a
 * crew-held or unheld order keeps this file about the rule it is testing.
 */
const ORDER = records.workOrders.find((order) => {
  if (isTerminal(order.status)) return false;
  const assignment = records.workOrderAssignments.find(
    (candidate) => candidate.workOrderId === order.id,
  );
  return !assignment?.userId;
})!;

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      {/* The shell supplies this; `CapabilityAction`'s denied branch is a
          tooltip and Radix refuses one without it. */}
      <TooltipProvider>{children}</TooltipProvider>
    </NextIntlClientProvider>
  );
}

it("has an order nobody personally holds to test the dialog on", () => {
  // The premise above, asserted rather than assumed: the seed could stop
  // holding such an order, and the dialog cases would then be measuring the
  // holder rule instead of this one.
  expect(ORDER, "no open order is free of a personal holder").toBeDefined();
  expect(
    records.workOrderAssignments.find(
      (candidate) => candidate.workOrderId === ORDER.id,
    )?.userId ?? null,
  ).toBeNull();
});

beforeEach(() => {
  useDemoStore.setState({
    status: "ready",
    data: records,
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
    auditSequence: 0,
    outbox: [],
  });
});

/** Every name the select offers, whichever group it puts them in. */
function offeredNames(select: HTMLSelectElement): string[] {
  return Array.from(select.querySelectorAll("option"))
    .map((option) => option.textContent?.trim() ?? "")
    .filter(Boolean);
}

function expectTheSameRule(select: HTMLSelectElement, surface: string) {
  const names = offeredNames(select);

  /*
   * The floor. A select that failed to render its people would satisfy every
   * "is not offered" assertion below and prove nothing at all.
   */
  expect(TECHNICIANS.length, "the seed holds no technicians").toBeGreaterThan(
    2,
  );
  expect(
    names.length,
    `${surface}: the select offered nobody, so the absences below mean nothing`,
  ).toBeGreaterThan(TECHNICIANS.length);

  expect(names, `${surface}: the auditor is offered work`).not.toContain(
    fullName(AUDITOR),
  );
  // And the people who can do the work are all still there — the fix is a
  // filter, and a filter that took too much would pass every line above.
  const missing = [INSPECTOR, ...TECHNICIANS, ...COORDINATORS]
    .map((person) => fullName(person))
    .filter((name) => !names.includes(name));
  expect(
    missing,
    `${surface}: somebody who can do the work is not offered`,
  ).toEqual([]);
}

describe("who each assignee list offers", () => {
  it("leaves the auditor out of the create form, and says so", async () => {
    render(
      <Providers>
        <CreateWorkOrderForm role="maintenanceCoordinator" />
      </Providers>,
    );

    const select = (await screen.findByLabelText(
      en.workOrderForm.fields.assignee,
    )) as HTMLSelectElement;
    expectTheSameRule(select, "create form");

    /*
     * Named, not silently missing. A list that quietly omits people is a list
     * a reader cannot check: a coordinator looking for the auditor should be
     * told the rule rather than left wondering whether the records are broken.
     */
    const hint = screen.getByText(/Not listed:/);
    expect(hint).toHaveTextContent(en.roles.auditor.name);
    expect(hint).not.toHaveTextContent(en.roles.inspector.name);
  });

  it("leaves the auditor out of the assign dialog too, and says so there", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <WorkOrderActions order={ORDER} role="maintenanceCoordinator" />
      </Providers>,
    );

    await user.click(
      screen.getByRole("button", {
        name: en.workOrderDetail.write.actions.assign,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText(
      en.workOrderDetail.write.assign.assignee,
    ) as HTMLSelectElement;
    expectTheSameRule(select, "assign dialog");

    const hint = within(dialog).getByText(/Not listed:/);
    expect(hint).toHaveTextContent(en.roles.auditor.name);
    expect(hint).not.toHaveTextContent(en.roles.inspector.name);
  });
});
