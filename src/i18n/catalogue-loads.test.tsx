// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

/**
 * The catalogue as next-intl reads it, rather than as JSON.
 *
 * Key parity, ICU shape and punctuation are all checked in `messages.test.ts`
 * by flattening both files and comparing the paths. That flattening joins keys
 * with "." — so a key whose own name contains a "." is invisible to every one
 * of those tests: `{"a": {"b.c": "…"}}` and `{"a": {"b": {"c": "…"}}}` flatten
 * to the same path. next-intl does not treat them as the same thing at all.
 * It reads "." as nesting, so the first is a key nothing can address, and in
 * the production build — where this warning is compiled out — a screen asking
 * for it prints the identifier to whoever is reading the screen.
 *
 * That is not a hypothetical: WA-22 put thirteen of them in, every catalogue
 * test stayed green, and what caught it was an unrelated component test that
 * counts `console.error` calls.
 *
 * So this asks next-intl, through the provider the application mounts. The
 * rule enforced here is use-intl's own (`validateMessages`), not a second
 * description of it written from the same misunderstanding that caused the
 * defect.
 */

function ReadsAMessage() {
  const t = useTranslations("app");
  return <span>{t("name")}</span>;
}

function complaintsFrom(messages: Record<string, unknown>): string[] {
  const console_ = vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <NextIntlClientProvider
      locale="en-CA"
      timeZone="America/Toronto"
      messages={messages as never}
    >
      <ReadsAMessage />
    </NextIntlClientProvider>,
  );

  return console_.mock.calls.map((call) => String(call[0]));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the catalogue next-intl is handed", () => {
  it("loads both languages with nothing to say about them", () => {
    for (const [name, catalogue] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      expect(complaintsFrom(catalogue), name).toEqual([]);
    }
  });

  it("still objects when a key holds a dot", () => {
    /*
     * The control, and it is load-bearing rather than decorative:
     * `validateMessages` exists only in use-intl's development build. If this
     * suite ever ran against the production one — or next-intl dropped the
     * check — the test above would pass on any catalogue at all, including the
     * broken one it was written for. This is what tells the difference between
     * "nothing is wrong" and "nothing is looking".
     */
    const planted = complaintsFrom({
      ...en,
      planted: { "a.b": "a key with a dot in its name" },
    });

    expect(planted.join("\n")).toContain("INVALID_KEY");
    expect(planted.join("\n")).toContain("a.b");
  });

  it("reads a nested key that spells the same path", () => {
    /*
     * The positive beside the negative. The test above proves a dotted key is
     * refused; on its own that is consistent with a catalogue where nothing
     * resolves. This proves the shape the fix moved to is the shape that
     * works: asking for "workOrder.create" under `roleTable.capability` finds
     * the words, and the screen shows a sentence rather than an identifier.
     */
    render(
      <NextIntlClientProvider
        locale="en-CA"
        timeZone="America/Toronto"
        messages={en as never}
      >
        <Capability />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByTestId("words").textContent,
      "the words for workOrder.create",
    ).toBe(en.roleTable.capability.workOrder.create);
  });
});

function Capability() {
  const t = useTranslations("roleTable.capability");
  return <span data-testid="words">{t("workOrder.create")}</span>;
}
