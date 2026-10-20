/**
 * A deterministic source of randomness.
 *
 * The seed has to look varied and be identical on every machine, in every
 * test run and in CI. `Math.random()` cannot do that, so nothing in
 * `src/data/seed` may call it: this generator is the only source, and it is
 * created from a fixed constant.
 *
 * mulberry32 — small, fast, well distributed enough for demo data, and short
 * enough to read.
 *
 * **One generator, drawn in order, so where you draw matters.** Every
 * collection in `buildSeed` shares this one stream, so a block that draws from
 * it shifts every record generated *after* it. WA-12 learned this the expensive
 * way: three `pick` calls added in the middle of the build, to choose a
 * storekeeper for some new inventory movements, rewrote **`documents`** — the
 * only collection after that point that draws from this generator at all.
 *
 * The blast radius was measured rather than assumed, and the first estimate of
 * it was wrong in both directions worth recording. It was reported as three
 * collections; `notifications` and `auditEvents` consume no randomness and were
 * never touched. And it was reported as the cause of 77 of the 134 committed
 * screenshots moving; the branch's actual share of those was **2**.
 *
 * Nothing was non-deterministic at any point, which is why no existing test
 * caught it. **Determinism promises the same input gives the same output. It
 * promises nothing about an addition leaving the rest of the output alone.**
 *
 * So: a new block placed in the middle of the build consumes no randomness —
 * derive what it needs by position, as `technicians[index % technicians.length]`
 * does — or it goes at the end, where there is nothing after it to disturb.
 * `fingerprint.test.ts` is what makes a breach of this fail with the name of
 * the collection that moved, instead of a pile of altered pictures.
 */
export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** A whole number in [min, max], both ends included. */
  int(min: number, max: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** `count` distinct items, in a stable order. Throws if there are too few. */
  sample<T>(items: readonly T[], count: number): T[];
  shuffle<T>(items: readonly T[]): T[];
  /** Two decimal places, for money. */
  money(min: number, max: number): number;
}

/**
 * The constant echoes the one the MP2 fixture generator used, so anyone
 * comparing the two datasets sees the same number in both places and knows
 * they were meant to line up.
 */
export const SEED_CONSTANT = 20260913;

export function createRandom(seed: number = SEED_CONSTANT): Random {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`Empty range: ${min}..${max}`);
    }
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    return items[int(0, items.length - 1)] as T;
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      const a = copy[i] as T;
      const b = copy[j] as T;
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  }

  function sample<T>(items: readonly T[], count: number): T[] {
    if (count > items.length) {
      throw new Error(`Asked for ${count} of ${items.length} items`);
    }
    return shuffle(items).slice(0, count);
  }

  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick,
    sample,
    shuffle,
    money: (min, max) => Math.round((min + next() * (max - min)) * 100) / 100,
  };
}
