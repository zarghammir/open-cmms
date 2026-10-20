import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildSeed, DEMO_DATA_KEYS, SEED_VERSION } from "./index";

/**
 * Every seeded collection, fingerprinted, so a change cannot disturb one that
 * nobody meant to touch.
 *
 * **The defect this exists for.** WA-12 added inventory movements and picked
 * their storekeeper with `random.pick`. `createRandom` is one sequential
 * generator shared by the whole build, and that block sits above `documents` —
 * the only collection after it that draws from the generator — so three draws
 * rewrote it. It surfaced as two committed screenshots moving, which is an
 * expensive and indirect way to learn that a seed edit went further than it
 * looked, and it was first misreported as three collections and as the cause of
 * 77 moved pictures. Neither held up: `notifications` and `auditEvents` consume
 * no randomness, and the branch's share of the 77 was 2. This test exists so
 * the next one of these is named rather than inferred.
 *
 * **Running that control reds two collections, not one, and they are different
 * kinds.** `documents` is the breach: it draws from the generator after the
 * block, so a stray draw rewrites records this ticket never meant to touch.
 * `inventoryTransactions` is not a breach at all — it is the block's own
 * records, and the storekeeper on each movement really does change when the
 * draw comes back. Only the first is a reason to fix the code; the second is
 * this test correctly noticing an intended change. Said here because a reader
 * who runs the control sees two reds, and a test whose whole purpose is to
 * name what moved should not leave half of what it names unexplained.
 *
 * `buildSeed` was deterministic throughout, which is exactly why nothing
 * caught it: `seed-integrity` already proves the same day gives the same
 * records, and that is a different promise. **Determinism says the same input
 * gives the same output; it says nothing about an addition leaving the rest of
 * the output alone.** This test is the second promise.
 *
 * **What moved at version 6.** `inventoryTransactions` alone. WA-41 pooled
 * each movement's part by the equipment it is fitted to and added an opening
 * balance row per part, and it was stated in advance that nothing else should
 * move: the opening counts were derived backwards from the on-hand each part
 * already had, so `parts` keeps every `quantityOnHand` and `notifications`
 * keeps every low-stock warning derived from one. The twenty-four unchanged
 * hashes below are also what proves the new block drew no randomness — a
 * single `pick` in it would have rewritten `documents`.
 *
 * **What moved at version 7.** `documents` alone. WA-21 adds paperwork on
 * work orders, mixed file types, the three kinds nothing drew, a three-version
 * chain and one document filed against the organisation. Stated in advance and
 * confirmed by running this test before touching it: nothing else moved, which
 * is also what proves the new block draws no randomness even though the only
 * collections after it derive nothing from the generator.
 *
 * **What moved at version 8.** `notifications` alone, among the collections
 * that already existed. WA-18 gives every notice an `eventKey` — the name of
 * the happening it reports, which is what stops the rules announcing the same
 * thing twice — and the three seeded notices carry `null` there, so the
 * collection's bytes change while its records do not. Two collections are new:
 * `emailLog`, empty in the seed because a line in it is the record of a
 * decision nothing has made yet, and `notificationPreferences`, one row per
 * person.
 *
 * The other twenty-three hashes are unchanged, and that is the load-bearing
 * half: the preferences block reads `users` and `facilities` and draws nothing
 * from the shared generator, so nothing after it moved. A single `pick` in it
 * would have rewritten `documents`, exactly as WA-12's did.
 *
 * **What moved at version 10.** `assetPlacements` and `floorPlans`, the two
 * collections WA-90 declares, and nothing else. They arrived empty — both
 * pinned to `4f53cda18c2baa0c`, the hash of `[]` — and this is where they are
 * filled: the Moncton drawing, one floor beside it with no drawing on file,
 * and the two assets that stand on the drawn floor.
 *
 * ```
 * assetPlacements  4f53cda18c2baa0c -> 06d9006baf86ca9b
 * floorPlans       4f53cda18c2baa0c -> edecbef570711423
 * ```
 *
 * The twenty-six unchanged hashes are the load-bearing half, and here they say
 * something specific: the placements are looked up by asset tag out of
 * `assets`, which is a read and not a draw, so the shared generator is where it
 * was and nothing after this block moved. A single `pick` in it would have
 * rewritten `documents`, exactly as WA-12's did.
 *
 * **`emailLog` and `importBatches` still share `4f53cda18c2baa0c`.** It is the
 * fingerprint of `[]` and both are empty in the seed — worth knowing before
 * concluding that two collections are somehow the same record.
 *
 * **What moved at WA-114, and why exactly three.** The owner read the map as
 * "it shows two machines", so the floor the drawing is of is populated from
 * the estate: eight machines now stand on `MCT-B01-F1` and all eight carry a
 * marker.
 *
 * ```
 * assetPlacements  06d9006baf86ca9b -> 3f1fe640f0d7c209
 * assets           29b8bae47e9c9309 -> 24f17d519989cfe4
 * workOrders       1abefda38dd01a8d -> e9281aee65f13465
 * ```
 *
 * `workOrders` is the one worth explaining: an order copies its machine's
 * `locationId` when it is raised, so an order goes where the machine goes.
 * Nothing about the orders themselves changed.
 *
 * **The machines were moved rather than added, and that choice is what keeps
 * this list to three.** Measured before it was written: appending a single
 * asset inside the site loop reddens eleven collections — `documents` and the
 * inspections sample from the asset array, `maintenanceSchedules` follows the
 * types on the estate, and every later draw from the shared generator shifts
 * behind them. Changing an asset's room reddens two. The drawing shows
 * biosafety cabinets and freezers, which Moncton holds no records of; adding
 * those is the eleven-collection change, and it waits for the owner's own
 * drawing, when the positions are re-traced anyway.
 *
 * **When this goes red.** Either a change disturbed a collection it did not
 * mean to — fix the change, not the hash — or a seed change was intended, in
 * which case the hashes are updated deliberately **in the same commit as the
 * `SEED_VERSION` bump**, and the pull request says which collections moved and
 * why. The version is asserted below so the two cannot drift apart: a new set
 * of hashes at an unchanged version means a browser seeded earlier the same
 * day keeps records the build no longer agrees with.
 *
 * **What moved at version 11. Nothing.** WA-112 adds `workflowRules` (one row)
 * and `notificationDefaults` (one per notifiable kind), and every one of the
 * twenty-nine hashes that existed at version 10 is unchanged.
 *
 * That is the requirement rather than a pleasant outcome. A version bump
 * rebuilds every reviewer's records, so a bump that also changed behaviour
 * would make the two impossible to tell apart the first time somebody said a
 * screen looked different. The rules are seeded to exactly what the
 * application already did: no transition switched off, a completion note still
 * required, both channels on for every kind. The unchanged hashes are also
 * what proves the two new builders draw nothing from the shared generator — a
 * single `pick` in either would have rewritten `documents`, which is the
 * collection that sits after them and the one WA-12 rewrote by accident.
 */

/** The day the fingerprints were taken at. Fixed, or the hashes mean nothing. */
const PINNED = new Date("2026-09-12T00:00:00.000Z");

/**
 * SHA-256 of each collection at `PINNED`, first sixteen hex characters.
 *
 * Every key in `DEMO_DATA_KEYS` appears, and the test below proves it — a
 * collection missing from this map would be a collection nothing is watching,
 * which is the shape of a guard that quietly stops guarding.
 */
const FINGERPRINTS: Record<string, string> = {
  assetPlacements: "767b04cace01c6f2",
  assetTypes: "cdbd33c133b46b5e",
  assets: "ce778777523423c5",
  auditEvents: "215345809d5177ba",
  documents: "f60ac9e634dc24d5",
  emailLog: "4f53cda18c2baa0c",
  facilities: "229dd742ed20015d",
  floorPlans: "2e2cbd6974c0fc83",
  importBatches: "4f53cda18c2baa0c",
  inspectionFindings: "c767ff5da9ee1f16",
  inspectionResults: "8e99eb0819f6f86d",
  inspectionTemplates: "24cce05902ed2ebc",
  inspections: "f31b9f39112c32a3",
  inventoryLocations: "fdfa4d85c2fb64f9",
  inventoryTransactions: "b7d9d0a619dd86a1",
  labourEntries: "f8bb4f143ab92e51",
  locations: "a5fb822eeb235a6d",
  maintenancePlans: "26ff57234a27fa53",
  maintenanceSchedules: "ddfe3c3773835523",
  notificationDefaults: "95397fa7ab89d7fe",
  notificationPreferences: "547b3d5f6b1b3a60",
  notifications: "dd282afb2a6b3060",
  organization: "792b9ed1601dae69",
  parts: "6d66b87c6cae8217",
  users: "3e9aae73ecd626b4",
  workOrderAssignments: "f9d21120df58e333",
  workOrderComments: "58689635c59a9b9b",
  workOrderStatusHistory: "ecdb4160c042f446",
  workOrderTasks: "169010a62b3c39a7",
  workOrders: "a6bda90206fc34a0",
  workflowRules: "f2b79b0995fbfda6",
};

/**
 * One digest of the whole map, per version it was correct at.
 *
 * Append a line when the seed's content changes; never edit one, because a
 * line here describes a version that has already been in somebody's browser.
 */
const DIGEST_BY_VERSION: Record<number, string> = {
  12: "3ce426c5b755b55f",
  13: "43043a5b2f074f38",
  14: "115f23ea0a173a5b",
};

/**
 * A hash over the fingerprint map, in sorted key order so moving a line
 * changes nothing — reordering is not a content change, and a guard that
 * reddened on it would be one people learn to update without reading.
 */
function digestOfFingerprints(): string {
  const sorted = Object.keys(FINGERPRINTS)
    .sort()
    .map((key) => `${key}:${FINGERPRINTS[key]}`)
    .join("|");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

describe("the seed's fingerprints", () => {
  const seed = buildSeed(PINNED) as unknown as Record<string, unknown>;

  it("watches every collection the seed declares", () => {
    /*
     * The floor. Without it, a collection dropped from the map below — or a
     * map that had drifted to a handful of keys — would leave most of the seed
     * unguarded while every assertion still passed.
     */
    expect(Object.keys(FINGERPRINTS).sort()).toEqual([...DEMO_DATA_KEYS]);
    expect(Object.keys(FINGERPRINTS).length).toBeGreaterThan(20);
  });

  it("has one recorded digest for the version it is at", () => {
    /*
     * THE GUARD, AND IT USED TO POINT THE WRONG WAY.
     *
     * This was `expect(SEED_VERSION).toBe(12)` — a literal beside the hashes.
     * That fires when the version moves and the hashes do not, and is **silent
     * when the hashes move and the version does not**, which is the direction
     * the comment above it was about. WA-114 is the instance: three
     * fingerprints updated, the version left alone, the whole suite green —
     * and a browser opened that morning kept records the build no longer
     * agreed with, showing two markers on a build whose point is eight.
     *
     * So the pin is a digest of the whole map, recorded **against the version
     * it belongs to**. Changing any collection's hash without moving the
     * version makes this version's recorded digest wrong; moving the version
     * without recording a digest leaves nothing to compare against. Each says
     * which happened.
     *
     * The record is append-only by intent, and that is what a single literal
     * could not give: a legitimate change **adds a line**, while silencing a
     * real finding means **editing a line describing a version already
     * shipped** — visible in a diff as rewriting history rather than as
     * updating a number.
     *
     * WHAT THE VERSION IS DOING HERE IS STALENESS, NOT READER COMPATIBILITY.
     * Two different jobs, and conflating them has now twice led to the wrong
     * conclusion. "No persisted shape changed, so no bump is needed" is true
     * about readers and wrong about this: a store is reused when the version
     * matches **and** it was seeded today, so a content change with no bump
     * reaches nobody who already has the demonstration open — and it
     * self-heals at the date rollover, which is why it is invisible to anyone
     * checking tomorrow. A demonstration is a same-day event, and so is
     * somebody looking to see whether what they reported is fixed.
     */
    const recorded = DIGEST_BY_VERSION[SEED_VERSION];

    expect(
      recorded,
      /*
       * The digest is IN the message, because the first thing anybody does
       * with this failure is go looking for the number to write down — and
       * the guard is the only thing that knows it. Without this you add a
       * placeholder line, run again to read the real value out of the second
       * assertion, then write it: two runs to append one line. Hit twice in
       * one day by the person who wrote the guard, and a stranger hits it
       * once with no idea what to do.
       */
      `SEED_VERSION is ${SEED_VERSION} and no digest is recorded for it. Append this line to DIGEST_BY_VERSION — never edit an existing one:\n  ${SEED_VERSION}: "${digestOfFingerprints()}",`,
    ).toBeDefined();

    expect(
      digestOfFingerprints(),
      `the collection hashes have moved but SEED_VERSION is still ${SEED_VERSION}. A store is reused when the version matches and it was seeded today, so this change reaches nobody who already has the demonstration open — bump the version and record its digest, rather than editing the line for ${SEED_VERSION}.`,
    ).toBe(recorded);
  });

  /*
   * One assertion per collection rather than one over the whole map, so a red
   * names the collection that moved. A single `toEqual` on an object of
   * twenty-five hashes reports that something changed and leaves the reader to
   * find out what — which is most of the work.
   */
  for (const key of DEMO_DATA_KEYS) {
    it(`leaves ${key} exactly as it was`, () => {
      expect(fingerprint(seed[key])).toBe(FINGERPRINTS[key]);
    });
  }

  it("would notice a collection that changed", () => {
    // The control: the assertions above compare a hash to a constant, and
    // would pass just as well if `fingerprint` returned the same string for
    // everything. Two different collections must fingerprint differently.
    expect(fingerprint(seed.parts)).not.toBe(fingerprint(seed.workOrders));
    expect(fingerprint([1, 2, 3])).not.toBe(fingerprint([1, 2, 4]));
  });
});
