// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { formats } from "@/i18n/formats";
import { ConflictDialog } from "./conflict-dialog";

/**
 * The conflict screen offers two answers and no way out.
 *
 * Until this test the only assertion on the dialog was that it is visible,
 * which the dead close button satisfied too: it rendered, it took focus, it was
 * named "Close" in English and "Fermer" in French, and pressing it did nothing
 * at all, because the dialog is pinned open with no `onOpenChange`. On a phone
 * an evaluator's first move on a modal is the ×, and being silently ignored is
 * the worst answer a screen can give.
 *
 * Both languages are checked rather than one, because the control was there in
 * both and a fix applied to a wrapper could miss a catalogue.
 */

const CONFLICT = {
  entry: { label: "WO-2026-0041" },
  server: {
    field: "status",
    value: "waitingForParts",
    by: "Sophie Gagnon",
    at: "2026-09-13T18:32:00.000Z",
  },
};

vi.mock("@/hooks/use-demo-data", () => ({
  useConflict: () => ({
    conflict: CONFLICT,
    keepMine: vi.fn(),
    keepTheirs: vi.fn(),
  }),
}));

const LANGUAGES = [
  // 18:32 UTC is 14:32 in Toronto, written "14 h 32" in French.
  { name: "English", locale: "en-CA", messages: en, time: /14:32/ },
  { name: "French", locale: "fr-CA", messages: fr, time: /14\s?h\s?32/ },
] as const;

type Language = (typeof LANGUAGES)[number];

function mount(locale: Language["locale"], messages: Language["messages"]) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="America/Toronto"
      formats={formats}
    >
      <ConflictDialog role="maintenanceCoordinator" />
    </NextIntlClientProvider>,
  );
}

describe.each(LANGUAGES)(
  "the conflict dialog in $name",
  ({ locale, messages, time }) => {
    it("offers the two answers and nothing else", () => {
      mount(locale, messages);
      const dialog = screen.getByRole("dialog");

      // The whole set, not a search for the one control we know about: any
      // third button — a close, a "later", a stray icon — fails this.
      expect(
        within(dialog)
          .getAllByRole("button")
          .map((button) => button.textContent?.trim()),
      ).toEqual([
        messages.offline.conflictKeepTheirs,
        messages.offline.conflictKeepMine,
      ]);

      expect(
        within(dialog).queryByRole("button", { name: messages.common.close }),
      ).toBeNull();
    });

    it("says when the server's version was made", () => {
      mount(locale, messages);

      // Two versions and no times is a choice made blind. The moment is
      // stamped when the queue is replayed, so it is always a real one — the
      // field carried an empty string before this, which a date formatter
      // turns into "Invalid Date" in front of whoever is deciding.
      expect(screen.getByRole("dialog").textContent ?? "").toMatch(time);
    });

    it("stays open when Escape is pressed", async () => {
      mount(locale, messages);
      await userEvent.keyboard("{Escape}");

      // Inert by design, and now asserted: the queue stops at a conflict, so a
      // dialog that could be escaped would leave the change unresolved with
      // nothing on screen saying so.
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(
        screen.getByText(
          messages.offline.conflictTitle.replace(
            "{record}",
            CONFLICT.entry.label,
          ),
        ),
      ).toBeVisible();
    });
  },
);
