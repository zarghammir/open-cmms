import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { documentRows, fileTypeOf, matchesSearch } from "./documents";

/**
 * What a document is filed against, and the two answers that are easy to draw
 * as a blank.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

describe("what a document is filed against", () => {
  const seed = buildSeed(TODAY);
  const rows = documentRows(seed, "en");

  it("names the asset, the order and the plan", () => {
    const states = new Set(rows.map((row) => row.filedAgainst.state));

    expect(states.has("asset")).toBe(true);
    expect(states.has("workOrder")).toBe(true);
    expect(states.has("maintenancePlan")).toBe(true);
  });

  it("calls the organisation's own document exactly that", () => {
    // Not an empty cell and not an orphan: a contract belongs to the
    // organisation, which is an answer.
    const organisation = rows.filter(
      (row) => row.filedAgainst.state === "organisation",
    );

    expect(organisation.length).toBeGreaterThanOrEqual(1);
    expect(organisation.length).toBeLessThan(rows.length);
  });

  it("says so when a document names a record that is not there", () => {
    /*
     * Nothing seeds this, and that is exactly why it is tested here: the state
     * exists for imported or hand-edited data, and a screen that drew it as
     * "organisation" would tell a reader a document about a missing asset
     * belongs to the organisation. Built on purpose, because a case with no
     * data is a branch drawn by nothing.
     */
    const broken = {
      ...seed,
      documents: [{ ...seed.documents[0]!, assetId: "ast-not-here" }],
    };

    const [row] = documentRows(broken, "en");

    expect(row!.filedAgainst.state).toBe("unresolved");
    expect(
      row!.filedAgainst.state === "unresolved" && row!.filedAgainst.label,
    ).toBe("ast-not-here");
  });

  it("does not read an unresolved link as the organisation's", () => {
    // The control for the test above, and the mistake it guards: a
    // `filedAgainst` written as a chain of truthiness checks falls through to
    // the organisation for any link that fails to resolve.
    const broken = {
      ...seed,
      documents: [{ ...seed.documents[0]!, assetId: "ast-not-here" }],
    };

    expect(documentRows(broken, "en")[0]!.filedAgainst.state).not.toBe(
      "organisation",
    );
  });
});

describe("naming a file type", () => {
  it("knows the three the system accepts", () => {
    expect(fileTypeOf("application/pdf")).toBe("pdf");
    expect(
      fileTypeOf(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("word");
    expect(
      fileTypeOf(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("excel");
  });

  it("calls anything else other, rather than guessing PDF", () => {
    // A default of "pdf" would label a record the upload would have refused as
    // the type it is most often — and hide, rather than show, that something
    // arrived by a path the upload does not guard.
    expect(fileTypeOf("image/jpeg")).toBe("other");
  });
});

describe("searching the library", () => {
  const seed = buildSeed(TODAY);
  const rows = documentRows(seed, "en");

  it("matches a file name and an empty term matches everything", () => {
    const first = rows[0]!;
    expect(matchesSearch(first, first.fileName.slice(0, 6))).toBe(true);
    expect(matchesSearch(first, "")).toBe(true);
  });

  it("does not match a term that is in no field", () => {
    expect(matchesSearch(rows[0]!, "zzzz-not-a-document")).toBe(false);
  });
});
