import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { roleMatrix, readsOnly } from "./role-matrix";
import { CAPABILITIES, ROLES, can } from "./roles";

/**
 * The table a person reads and the rule the buttons obey cannot disagree.
 *
 * They cannot disagree because there is only one of them: `roleMatrix()` asks
 * `can()`, which is what every gated control asks. So most of this file is not
 * checking that they agree — that would be asking one question twice — but that
 * the table is still **generated** rather than written out, and that every row
 * has words in both languages.
 *
 * The exception is the block of spot checks. Those are a second description,
 * taken from the ticket's own sentences rather than from the code, and they are
 * the part a deletion control reddens: remove a capability from a role and the
 * row is named.
 */

describe("the role table", () => {
  const matrix = roleMatrix();

  it("has a row per capability and a column per role", () => {
    /*
     * The floors. Every assertion below walks the matrix, so a generator that
     * returned nothing — a renamed `CAPABILITIES`, a filter that matched none —
     * would leave them all passing over an empty table.
     */
    expect(matrix.map((row) => row.capability)).toEqual([...CAPABILITIES]);
    expect(matrix.length, "rows").toBeGreaterThan(10);
    for (const row of matrix) {
      expect(
        row.allowed,
        `${row.capability}: one answer per role`,
      ).toHaveLength(ROLES.length);
    }
    expect(ROLES.length, "columns").toBe(6);
  });

  it("answers each cell with the rule itself", () => {
    /*
     * Deliberately the same question, and worth one test.
     *
     * Today this cannot fail: both sides call `can()`. It exists for the day
     * somebody replaces the generator with a literal — which is the change that
     * would put a wrong table in front of a person, and which no type would
     * object to.
     */
    for (const [index, row] of matrix.entries()) {
      for (const [column, role] of ROLES.entries()) {
        expect(
          row.allowed[column],
          `row ${index} (${row.capability}) × ${role}`,
        ).toBe(can(role, row.capability));
      }
    }
  });

  it("says what the ticket says, in the places the ticket names", () => {
    /*
     * The second description, and the only part of this file that can disagree
     * with the rule. Written from the ticket's own sentences rather than read
     * off `ROLE_CAPABILITIES`, which is what makes it evidence rather than an
     * echo — and what makes a deletion control name a row.
     */
    const cell = (capability: string, role: string) =>
      matrix.find((row) => row.capability === capability)!.allowed[
        ROLES.indexOf(role as (typeof ROLES)[number])
      ];

    // "The administrator edits a person; changes a workflow rule."
    expect(
      cell("users.manage", "administrator"),
      "administrator manages users",
    ).toBe(true);
    expect(
      cell("settings.manage", "administrator"),
      "administrator edits rules",
    ).toBe(true);

    // "Facility manager: reads the people at their sites; changes nothing"
    // about people — but Settings is theirs, and so is the demonstration reset.
    expect(
      cell("users.manage", "facilityManager"),
      "facility manager manages users",
    ).toBe(false);
    expect(
      cell("settings.manage", "facilityManager"),
      "facility manager edits rules",
    ).toBe(true);

    // "Auditor: reads everything; every control disabled with the reason."
    for (const capability of CAPABILITIES) {
      expect(cell(capability, "auditor"), `auditor may ${capability}`).toBe(
        false,
      );
    }
    expect(readsOnly("auditor"), "the auditor reads and does nothing").toBe(
      true,
    );
    expect(readsOnly("administrator"), "the administrator only reads").toBe(
      false,
    );

    // A technician finishes work and may not call it off: the coordinator's
    // decision, not theirs.
    expect(cell("workOrder.complete", "technician")).toBe(true);
    expect(cell("workOrder.cancel", "technician")).toBe(false);
    expect(cell("workOrder.cancel", "maintenanceCoordinator")).toBe(true);

    // An inspector records findings, not stock.
    expect(cell("inspection.complete", "inspector")).toBe(true);
    expect(cell("inventory.issue", "inspector")).toBe(false);
  });

  it("has plain words for every row, read the way a screen reads them", () => {
    /*
     * Through next-intl, not out of the JSON — because reading the file
     * directly is a different question from the one the screen asks, and this
     * test passed on a catalogue no screen could read.
     *
     * The first version indexed `en.roleTable.capability[capability]`, which
     * found `"workOrder.create"` as a literal key and went green. next-intl
     * splits a key on "." as nesting, so what the screen would have found was
     * nothing: a missing message, printing the identifier to an evaluator in
     * the production build where the warning is compiled out. The catalogue is
     * now nested, and asking through `t()` is what makes that a thing this
     * test can fail on.
     *
     * The collected errors are the assertion. `t()` returns the key path when
     * a message is missing, so the returned string alone would look like a
     * plain failure to translate rather than a broken key.
     */
    for (const [name, catalogue] of [
      ["en-CA", en],
      ["fr-CA", fr],
    ] as const) {
      const complaints: string[] = [];
      const t = createTranslator({
        locale: name,
        messages: catalogue,
        namespace: "roleTable.capability",
        onError: (error) => complaints.push(error.message),
      });

      for (const capability of CAPABILITIES) {
        const text = t(capability);

        expect(
          complaints,
          `${name} cannot read the words for ${capability}`,
        ).toEqual([]);
        expect(
          text.length,
          `${name}'s words for ${capability} are too short to be a phrase`,
        ).toBeGreaterThan(3);
        expect(
          text,
          `${name} left the identifier in place for ${capability}`,
        ).not.toContain(capability);
      }
    }
  });
});
