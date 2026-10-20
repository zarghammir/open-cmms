import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import type { DocumentRecord } from "@/domain/types";
import { applyMutation, type Actor } from "@/stores/mutations";
import { createDocumentRepository, UnsupportedFileTypeError } from "./document";
import type { RepositoryContext } from "./types";

/**
 * Reaching a document, and recording one without storing it.
 *
 * The queries are the interesting half. A document filed against nothing is
 * the case the type always allowed, the seed never held and no query could
 * reach — so it could not be shown, and nothing reported that it could not.
 */

const NOW = new Date("2026-09-13T14:05:00.000Z");
const ACTOR: Actor = { userId: "usr-fortin", role: "administrator" };

const PDF = "application/pdf";
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function harness(seed: DemoData = buildSeed(NOW)) {
  let data = seed;
  let sequence = 0;
  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      sequence += 1;
      data = applyMutation(
        data,
        mutation,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    commitMany() {
      throw new Error("not used here");
    },
    now: () => NOW,
  };
  return {
    repository: createDocumentRepository(context),
    get data() {
      return data;
    },
  };
}

describe("reaching documents", () => {
  const seed = buildSeed(NOW);
  const repository = harness(seed).repository;

  it("finds the paperwork on a work order", () => {
    const filed = seed.documents.find((one) => one.workOrderId !== null)!;
    const found = repository.forWorkOrder(filed.workOrderId!);

    expect(found.map((one) => one.id)).toContain(filed.id);
    expect(found.every((one) => one.workOrderId === filed.workOrderId)).toBe(
      true,
    );
  });

  it("finds a document filed against the organisation and nothing else", () => {
    const organisational = repository.forOrganisation();

    expect(organisational.length).toBeGreaterThan(0);
    for (const one of organisational) {
      expect(one.assetId).toBeNull();
      expect(one.workOrderId).toBeNull();
      expect(one.facilityId).toBeNull();
      expect(one.maintenancePlanId).toBeNull();
    }
  });

  it("does not hand back a filed document as an organisation one", () => {
    /*
     * The control. `forOrganisation` written the short way — everything with no
     * asset — would return the plan's procedures and the work-order paperwork
     * too, and every assertion above would still pass: they are documents, they
     * are in the list, and nobody counted them.
     */
    const organisational = new Set(
      repository.forOrganisation().map((one) => one.id),
    );
    const onAPlan = seed.documents.filter(
      (one) => one.maintenancePlanId !== null,
    );

    expect(onAPlan.length).toBeGreaterThan(0);
    for (const one of onAPlan) {
      expect(organisational.has(one.id)).toBe(false);
    }
  });

  it("walks a version chain newest first, and stops at the first of its line", () => {
    const newest = seed.documents.find(
      (one) => one.previousVersionId !== null && one.version === 3,
    )!;
    const chain = repository.versionsOf(newest.id);

    expect(chain.map((one) => one.version)).toEqual([3, 2, 1]);
    expect(chain.at(-1)!.previousVersionId).toBeNull();
  });

  it("calls a document that replaced nothing a history of one", () => {
    // Not zero, and not an error: one row is the whole history there is.
    const alone = seed.documents.find((one) => one.previousVersionId === null)!;
    expect(repository.versionsOf(alone.id).map((one) => one.id)).toEqual([
      alone.id,
    ]);
  });

  it("does not spin on a chain that points back at itself", () => {
    /*
     * A chain is data, and data can be circular — an import, a hand-edited
     * store, a future screen that lets somebody pick the wrong predecessor.
     * Without the seen set this walks for ever and takes the screen with it,
     * which is a defect no amount of correct seeding would reveal.
     */
    const [a, b] = seed.documents;
    const looped: DocumentRecord[] = [
      { ...a!, previousVersionId: b!.id },
      { ...b!, previousVersionId: a!.id },
    ];
    const test = harness({ ...seed, documents: looped });

    expect(test.repository.versionsOf(a!.id).map((one) => one.id)).toEqual([
      a!.id,
      b!.id,
    ]);
  });
});

describe("recording a file without storing it", () => {
  const request = {
    title: { en: "Pump curve", fr: "Courbe de pompe" },
    kind: "manual" as const,
    fileName: "pump-curve.pdf",
    mimeType: PDF,
    sizeBytes: 220 * 1024,
  };

  it("writes the record and one trail entry", () => {
    const test = harness();
    const before = test.data.documents.length;
    const audits = test.data.auditEvents.length;

    const written = test.repository.upload(
      { ...request, assetId: test.data.assets[0]!.id },
      ACTOR,
    );

    expect(test.data.documents).toHaveLength(before + 1);
    expect(test.data.documents.some((one) => one.id === written.id)).toBe(true);
    expect(test.data.auditEvents).toHaveLength(audits + 1);
    expect(test.data.auditEvents[0]?.summaryKey).toBe("audit.documentUploaded");
    expect(written.version).toBe(1);
    expect(written.sizeBytes).toBe(220 * 1024);
  });

  it("counts a new version on from the one it replaces", () => {
    const test = harness();
    const existing = test.data.documents.find((one) => one.version === 3)!;

    const written = test.repository.upload(
      { ...request, mimeType: XLSX, previousVersionId: existing.id },
      ACTOR,
    );

    expect(written.version).toBe(4);
    expect(written.previousVersionId).toBe(existing.id);
    expect(
      test.repository.versionsOf(written.id).map((one) => one.version),
    ).toEqual([4, 3, 2, 1]);
  });

  it("refuses a file type it does not take, and writes nothing", () => {
    /*
     * Asserted on the records rather than on the throw alone: a repository that
     * threw *after* writing would satisfy `toThrow` and leave the document
     * behind. The screen checks the type first so it can say so in the reader's
     * language; this is the check a second upload surface cannot walk around.
     */
    const test = harness();
    const before = test.data.documents.length;
    const audits = test.data.auditEvents.length;

    expect(() =>
      test.repository.upload({ ...request, mimeType: "image/jpeg" }, ACTOR),
    ).toThrow(UnsupportedFileTypeError);

    expect(test.data.documents).toHaveLength(before);
    expect(test.data.auditEvents).toHaveLength(audits);
  });

  it("accepts the Office types the RFP names", () => {
    // The control beside the refusal: a repository that refused everything
    // would pass the test above and fail nothing else here.
    const test = harness();
    expect(() =>
      test.repository.upload({ ...request, mimeType: XLSX }, ACTOR),
    ).not.toThrow();
  });
});

/**
 * `upload` writes once, and that is a rule rather than a workaround.
 *
 * This block used to hold two more tests. They characterised the shape the
 * application had before WA-76: the context handed every repository the `data`
 * of one render, so two uploads in one handler minted the same id and the
 * second was refused. One asserted that collision; the other was its control,
 * showing the same pair succeeding against a live context.
 *
 * **Both are deleted rather than updated, which is what their own comment asked
 * for.** WA-76 made the application read live records, so the shape they
 * described no longer exists — and a test that describes a defect, kept alive
 * after the defect is gone, becomes a test that asserts the workaround.
 *
 * What stays is the guard they sat around, and it never depended on the
 * context: a second `commit` inside `upload` — a notification, a version
 * stamp, an index row — would read the records as they were before its own
 * first write. One act, one entry in the trail, is the repository rule
 * everywhere in this codebase.
 */
describe("upload writes once", () => {
  const request = {
    title: { en: "Pump curve", fr: "Courbe de pompe" },
    kind: "manual" as const,
    fileName: "pump-curve.pdf",
    mimeType: PDF,
    sizeBytes: 220 * 1024,
  };

  it("commits exactly once per call, whatever the context is", () => {
    /*
     * The guard, as opposed to the two characterisations around it.
     *
     * `upload` is exposed to the snapshot only because it derives an id and a
     * version from a read, and it survives that today by writing once. A
     * second `commit` added inside it — a notification, a version stamp, an
     * index row — would read the records as they were before its own first
     * write, and this names it the moment it happens.
     *
     * This stays true and stays useful after WA-76: one act, one entry in the
     * trail, is the repository rule everywhere in this codebase, not a
     * workaround for a context that is about to change.
     */
    let commits = 0;
    let data = buildSeed(NOW);
    const context: RepositoryContext = {
      get data() {
        return data;
      },
      commit(mutation, at) {
        commits += 1;
        data = applyMutation(
          data,
          mutation,
          at ?? NOW.toISOString(),
          `aud-live-${commits}`,
        );
      },
      commitMany() {
        throw new Error("upload does not batch: if it ever does, this is why");
      },
      now: () => NOW,
    };

    createDocumentRepository(context).upload(request, ACTOR);

    expect(commits).toBe(1);
  });
});
