// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { formats } from "@/i18n/formats";
import { CreateWorkOrderForm } from "./create-work-order-form";

/**
 * Every control in this form says when it is not accepting input.
 *
 * WA-67 wrapped the fields in a `disabled` fieldset so that typing during a
 * save cannot be wiped by the reset that follows it. A disabled control that
 * looks exactly like a live one is a worse screen than the one before: it
 * refuses every keystroke and every click while telling the person nothing, so
 * they conclude the application is broken rather than busy.
 *
 * **Twice now the same defect has been found by eye rather than by a test.**
 * First the primitives: only the vendored `Input` carried disabled styling, so
 * five of the eight controls stayed at full contrast. Then, after that was
 * fixed, the Description box — because it rendered a bare `<textarea>` with its
 * own class string and never reached the primitive at all.
 *
 * So this asserts the property rather than either instance. It reads the
 * classes off the rendered controls, which is what both defects broke and what
 * any third way of breaking it would also break: a new field written bespoke, a
 * primitive that loses the classes, a control moved out of the fieldset.
 *
 * It does not assert that they are *disabled* — `disabled:` classes apply only
 * when they are, and driving this form into its saving state means holding a
 * real write open. That belongs to the browser suite, which does it. What can
 * rot here without anybody noticing is the styling contract, and this reads it
 * directly.
 */

const ASSET = {
  id: "ast-1",
  tag: "AHU-01",
  name: { en: "Air handling unit", fr: "Centrale de traitement d'air" },
  status: "active" as const,
};

const PERSON = {
  id: "usr-1",
  name: "Alex Tremblay",
  role: "technician" as const,
};

vi.mock("@/hooks/use-demo-data", () => ({
  useRepositories: () => ({
    status: "ready",
    repositories: {
      assets: { list: () => [ASSET], byTag: () => null },
      users: { list: () => [PERSON] },
      workOrders: { create: vi.fn() },
    },
  }),
  useActor: () => ({ userId: PERSON.id, role: "maintenanceCoordinator" }),
}));

/** The classes that make a refusal visible, as the primitives carry them. */
const DISABLED_STYLING = ["disabled:opacity-50", "disabled:cursor-not-allowed"];

function mount() {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      <CreateWorkOrderForm role="maintenanceCoordinator" />
    </NextIntlClientProvider>,
  );
}

it("dims every control the fieldset can disable", () => {
  mount();

  const fieldset = screen.getByRole("group");
  const controls = Array.from(
    fieldset.querySelectorAll<HTMLElement>("input, select, textarea"),
  ).filter((control) => control.getAttribute("type") !== "hidden");

  /*
   * The floor, and this test is worth nothing without it.
   *
   * `querySelectorAll` returning nothing would satisfy every assertion below
   * it — a form that rendered no fields at all would pass, and so would one
   * whose fieldset had been renamed out from under the query. Eight is what
   * the form has: four selects, three inputs and the description.
   */
  expect(
    controls.length,
    "the fieldset holds no controls — this test is reading the wrong element",
  ).toBeGreaterThanOrEqual(8);

  for (const control of controls) {
    for (const styling of DISABLED_STYLING) {
      expect(
        control.className,
        `<${control.tagName.toLowerCase()} id="${control.id}"> does not say when ` +
          "it is refusing input: it keeps full contrast and an ordinary cursor " +
          "while the fieldset has it disabled",
      ).toContain(styling);
    }
  }
});
