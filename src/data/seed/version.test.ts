import { describe, expect, it } from "vitest";
import { buildSeed, DEMO_DATA_KEYS, SEED_VERSION } from "./index";

/**
 * The stored shape cannot change without the version being reconsidered.
 *
 * The store rebuilds rather than migrates, so a new collection that arrives
 * without a version bump leaves a browser seeded earlier the same day holding
 * records that lack it — and the first read of that collection throws. It is
 * not a hypothetical: it happened on this branch, and review caught it rather
 * than a test.
 *
 * So the shape is written down beside the number. Adding a collection turns
 * this red, and the list a person then edits sits directly under the version
 * they must edit too.
 */
describe("the seed's shape and its version", () => {
  it("holds exactly the collections recorded beside the version", () => {
    const built = Object.keys(buildSeed(new Date("2026-09-13T00:00:00.000Z")));
    expect(built.sort()).toEqual([...DEMO_DATA_KEYS]);
  });

  it("would notice a collection that arrived without being declared", () => {
    // The control: the assertion above compares two lists, and would pass on
    // two empty ones. This proves the list is populated and that an undeclared
    // key really does fall outside it.
    expect(DEMO_DATA_KEYS.length).toBeGreaterThan(20);
    expect(DEMO_DATA_KEYS).toContain("importBatches");
    const withExtra = ["aThrowawayCollection", ...DEMO_DATA_KEYS].sort();
    expect(withExtra).not.toEqual([...DEMO_DATA_KEYS]);
  });

  it("is at the version this shape was recorded for", () => {
    /*
     * WA-35 took it to 2 for `importBatches`, WA-37 to 3 for `labourEntries`
     * and `workOrderComments`, WA-44 to 4 for the actor on an audit entry,
     * which became two shapes — a person with an id and a role, or the
     * application with neither. One number cannot stand for two, which is why
     * this is pinned rather than derived.
     *
     * The fourth was the first that was not a new collection: a stored record
     * that changes shape is the same hazard as a collection that arrives.
     *
     * **5 is the first that is neither.** WA-12 changes only *content* — shelf
     * counts, receipts and returns, so a part's ledger has more than one line.
     * Nothing changes shape and nothing would throw, so the framing above does
     * not reach it, and it is worth saying why it is here anyway.
     *
     * The operative rule is not this file's title, it is `demo-store.ts`:
     * `usable = seedVersion === SEED_VERSION && seededOn === day`. A browser
     * that opened the demonstration **earlier the same day** satisfies both
     * without a bump and keeps its old records — so a reviewer pulling this
     * branch sees a one-line ledger drawn by code that builds a longer one, and
     * concludes the feature does not work. Nothing fails; the screen simply
     * tells them something untrue, which is worse than a crash because a crash
     * gets investigated.
     *
     * So the number tracks "records a build would disagree with", not "shape"
     * alone. The records are entirely generated and the store rebuilds rather
     * than migrates, so the bump discards nothing that was not disposable.
     *
     * **6 is the second, and for the same reason.** WA-41 pools each movement's
     * part by the equipment's category and opens every ledger with a balance
     * row, so the movements a stored seed holds are not the ones this build
     * makes. No collection is added and no field changes shape. A browser that
     * opened the demonstration earlier the same day would keep a ledger whose
     * rows name implausible parts and do not add up to the stock figure beside
     * them — while the code in front of the reader builds one that does.
     *
     * **7 is a shape change, the first since 4.** WA-21 gives `DocumentRecord`
     * two new fields, `maintenancePlanId` and `previousVersionId`, so a
     * document stored before this branch has neither. Without the bump a
     * browser seeded earlier the same day keeps those documents and
     * `versionsOf` walks a chain whose links are `undefined` — the reader is
     * new and the records are old, which is the case this file exists for.
     * `persisted-shape.test.ts` proves the discard happens through persist and
     * not through `setState`, which is the only way that check means anything.
     *
     * **8 is both kinds at once.** WA-18 adds two collections — `emailLog` and
     * `notificationPreferences` — and gives every `Notification` an
     * `eventKey`. A browser seeded earlier the same day would hold notices
     * with no key, and the rules would then re-announce every one of them,
     * because the key is how a rule recognises an event it has already
     * reported. The reader would be new, the records old, and the symptom
     * would be the bell filling with duplicates — which reads as a broken
     * feature rather than as stale records.
     *
     * **9 is content, and the largest content move so far.** WA-87 puts
     * containment equipment in Moncton and food-laboratory instruments at
     * Sudbury and Kingston, and gives every kind of equipment an age
     * ceiling. No collection is added and no stored field changes shape — the
     * ceiling is a fact about the seed's catalogue, not a field on the record —
     * so nothing would throw and the framing at the top of this file does not
     * reach it.
     *
     * It is 9 rather than 8 because WA-18 reached main first and one number
     * cannot stand for two shapes. That rule is why this reads as a sequence
     * of reasons rather than a count of releases.
     *
     * What reaches it is `demo-store.ts` again. A browser that opened the
     * demonstration earlier the same day keeps an estate with no differential
     * pressure monitors, no effluent decontamination and no stomacher, holding
     * assets older than their own equipment would be, and a parts ledger whose
     * opening balances no longer reconcile with the pinned figures this build
     * asserts. Every one of those is a screen telling a reviewer something
     * untrue while the code in front of them builds something else — and the
     * fingerprints that moved say exactly how much of the data it is.
     *
     * **10 is a new collection again, which is the original reason this file
     * exists.** WA-90 adds `assetPlacements` — where each placed asset sits on
     * its floor — and `floorPlans`. A browser seeded earlier the same day holds
     * neither, and the first read of `data.assetPlacements` on the map would
     * throw rather than draw an empty floor. Rebuilt rather than migrated,
     * which is the documented behaviour for generated data.
     */
    /*
     * **11 is two new collections, and it arrived without an entry here.**
     * WA-112 adds `workflowRules` and `notificationDefaults` — which status
     * moves an administrator has switched off, and which notifications are on
     * by default. A browser seeded earlier the same day holds neither, and the
     * work-order repository reads `workflowRules[0]` on every status move, so
     * the read that would throw is on the path every write takes.
     *
     * Written here by WA-114 while resolving the merge, not by the branch that
     * made the bump. The file is a sequence of reasons and a number with no
     * reason breaks the sequence — and the paragraph below names 11 to explain
     * why this one is 12, which would otherwise point at nothing.
     */
    /*
     * **12 is staleness, not shape, and I got this wrong before the review
     * caught it.** WA-114 adds no collection and changes no stored field: an
     * old reader meets nothing it cannot parse, which is the question I asked
     * and answered correctly. It is the wrong question. The operative rule is
     * the one at the top of this file — `usable = seedVersion === SEED_VERSION
     * && seededOn === day` — so a browser that opened the demonstration
     * **earlier the same day** keeps its records without a bump.
     *
     * What those records hold is the floor the owner complained about: two
     * markers, because the estate had not been moved yet. Reviewed by planting
     * exactly that state — version 10, dated today, placements cut to two —
     * and reloading: two markers, no rebuild, on a build whose whole purpose
     * is to show eight. The person most likely to be holding that store is the
     * one who asked why only two were marked.
     *
     * It self-heals at the date rollover, which is why this is a bump rather
     * than an alarm. But a demonstration is a same-day event, and so is
     * somebody checking whether the thing they complained about got fixed.
     *
     * **12 rather than 11 because WA-112 took 11.** It merged first, which
     * is what this number depended on; had the order gone the other way one
     * bump would have stood for two shapes and this would have been wrong.
     */
    /*
     * **13 is the same records drawn a different way, and the records moved
     * with the drawing.** WA-121 replaces the rendered picture with an
     * architectural line drawing and gives every tracked machine its true
     * footprint, so every placement's rectangle changes and the plan record
     * points at a new asset of a new size. No collection arrives and no field
     * changes shape — this is the staleness half again, and a browser opened
     * earlier the same day would keep eight footprints traced against a drawing
     * it no longer has, which puts every shape in the wrong place on a plan
     * whose walls are somewhere else. The one failure mode worse than a blank
     * floor is a floor that looks right and is not.
     */
    /*
     * **14 is every record renamed.** The five sites are renamed for
     * publication — new codes, new cities, new provinces — and a site code is
     * the first segment of every location code, every bin code and every asset
     * tag, so twelve of the twenty-nine collections move at once. This is the
     * reader half rather than the staleness half: a browser holding version 13
     * has records whose codes no longer exist anywhere in the build, and a
     * screen resolving a tag against them finds nothing rather than something
     * wrong. It still has to rebuild, and the notice is what makes that
     * honest.
     *
     * **14 rather than 13 because WA-121 took 13**, for the same reason 12
     * rather than 11 above. One bump cannot stand for two shapes.
     */
    expect(SEED_VERSION).toBe(14);
  });
});
