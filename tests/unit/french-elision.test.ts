import { describe, expect, it } from "vitest";
import fr from "../../messages/fr.json";

/**
 * No French sentence puts an elidable word straight before a value.
 *
 * French elides before a vowel or a mute h: `de Administrateur` is wrong and
 * `d’Administrateur` is right. **A template cannot do that for itself**, because
 * it does not know what will land in the placeholder — so "de {role}" is
 * correct for `Technicien`, wrong for `Administrateur` and `Inspecteur`, and
 * wrong again for the next vowel-initial value somebody adds.
 *
 * Found on WA-124 by a reviewer reading the trail: "A fait passer Amélie
 * Fortin de Administrateur à Technicien". Two roles were visibly affected and
 * fixing those two would have been the wrong fix, because elision is a
 * property of French before any vowel, not a property of those two words.
 *
 * **THE FIX WAS TO REMOVE THE ELISION POINT, NOT TO HANDLE IT.** Every
 * sentence that had one now puts a fixed noun between the preposition and the
 * value — `du rôle {fromRole}`, `du site {fromSite}`, `de la pièce
 * {partNumber}` — or uses a preposition that never elides, like `vers`. That
 * is why there is no per-value table to keep up to date and no helper to
 * remember to call: adding a role, a status or a site cannot reintroduce this,
 * because the sentence no longer depends on the first letter of anything.
 *
 * What is left to guard is the other direction — somebody writing a NEW French
 * string with `de {thing}` in it. That is what this test is for, and it asks
 * the catalogue rather than a list of roles: it reads every French string,
 * finds every elidable word sitting directly before a placeholder, and fails
 * on any that is not listed below with a reason.
 */

/**
 * Every elidable word in French. Not only the ones we happen to use: the
 * point of the list is that a string using a different one is still caught.
 */
const ELIDABLE = [
  "de",
  "le",
  "la",
  "que",
  "ce",
  "ne",
  "se",
  "me",
  "te",
  "je",
  "jusque",
  "lorsque",
  "puisque",
  "quoique",
];

/*
 * The `u` flag and `\p{L}` rather than `\w`, and that is not a detail.
 *
 * JavaScript's `\w` is ASCII-only, so a lookbehind written with it does not
 * see the `ô` in "rôle" or the `è` in "pièce" as part of a word — and the
 * pattern then matched the last two letters of those words as if they were the
 * article "le" and the pronoun "ce". Seven false positives on the first run,
 * including the very strings this change had just fixed. A guard that cries
 * wolf on correct French is a guard somebody switches off.
 */
const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}’'-])(${ELIDABLE.join("|")})\\s+\\{\\s*(\\w+)`,
  "giu",
);

/**
 * The places where an elidable word before a placeholder is correct, each with
 * the reason it cannot go wrong.
 *
 * Every one of these is followed by a formatted date or a number. French does
 * not elide before a digit — "le 8 avril", "de 4 à 6" — so the first character
 * is known and it is never a vowel.
 *
 * The key is the catalogue path. A stale entry fails the test below just as a
 * new offender does: an exemption that no longer describes anything is an
 * exemption nobody has read since the string it named was deleted.
 */
const DATE_OR_NUMBER: Record<string, string> = {
  "assetDetail.workOrders.overdueOn": "a formatted date",
  "assetDetail.inspections.performedOn": "a formatted date",
  "assetDetail.inspections.scheduledFor": "a formatted date",
  "assetDetail.documents.uploadedOn": "a formatted date",
  "notifications.workOrderDueSoon": "a formatted date",
  "notifications.inspectionDue": "a formatted date",
  "workOrderDetail.raisedOn": "a formatted date",
  "workOrderDetail.due.passed": "a formatted date",
  "workOrderDetail.tasks.completedBy": "a formatted date",
  "audit.dataRefreshed": "two formatted dates",
  "audit.partAdjusted": "two stock counts",
  "audit.importCommitted": "a count of records",
  "audit.taskTicked": "a work-order number, which starts with W",
  "audit.taskUnticked": "a work-order number, which starts with W",
  "dataTable.rowsFiltered": "two row counts",
};

interface Hit {
  path: string;
  word: string;
  param: string;
  text: string;
}

function everyString(node: unknown, path: string, into: Hit[]): void {
  if (typeof node === "string") {
    for (const match of node.matchAll(PATTERN)) {
      into.push({
        path,
        word: match[1] as string,
        param: match[2] as string,
        text: node,
      });
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      everyString(value, path ? `${path}.${key}` : key, into);
    }
  }
}

describe("French elision", () => {
  const hits: Hit[] = [];
  everyString(fr, "", hits);

  it("has strings to check", () => {
    // Without this a catalogue that failed to load would satisfy everything
    // below by having nothing in it.
    expect(hits.length).toBeGreaterThan(10);
  });

  it("puts no elidable word directly before a value", () => {
    const offenders = hits
      .filter((hit) => !(hit.path in DATE_OR_NUMBER))
      .map(
        (hit) => `${hit.path}: «${hit.word} {${hit.param}}» in "${hit.text}"`,
      );

    expect(
      offenders,
      "French elides before a vowel, so these read wrong the moment the value " +
        "starts with one — put a fixed noun between the preposition and the " +
        "placeholder (du rôle {x}, de la pièce {x}) or use a preposition that " +
        "does not elide (vers, à). If the value can only ever be a date or a " +
        "number, add the key to DATE_OR_NUMBER with the reason.",
    ).toEqual([]);
  });

  it("exempts nothing that has stopped existing", () => {
    const matched = new Set(hits.map((hit) => hit.path));
    const stale = Object.keys(DATE_OR_NUMBER).filter(
      (path) => !matched.has(path),
    );

    expect(
      stale,
      "these keys are exempted and no longer contain an elidable word before " +
        "a placeholder, so the exemption is describing nothing and should go",
    ).toEqual([]);
  });
});
