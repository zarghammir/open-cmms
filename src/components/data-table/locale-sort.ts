/**
 * Ordering, in the reader's language.
 *
 * TanStack's default comparator comes down to `<` on strings, which compares
 * UTF-16 code units. That puts every accented letter after `z`, so a French
 * table sorted "alphabetically" is not in French alphabetical order at all:
 * "Réfrigérateur de laboratoire" lands after "Refroidisseur centrifuge"
 * because é is U+00E9 and o is U+006F.
 *
 * The order changing when the reader switches language is correct — French and
 * English genuinely order words differently, and "cote, côte, coté, côté" in
 * French is "cote, coté, côte, côté" in English. The order being non-French
 * inside French is the defect.
 *
 * `numeric` is on so that a tag ending 2 sorts before one ending 11 rather
 * than after it, which is the other thing people notice immediately.
 */
export function createLocaleCompare(
  locale: string,
): (a: unknown, b: unknown) => number {
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "variant",
  });

  return (a, b) => {
    if (a === b) return 0;

    // Absent values go last in either direction rather than sorting as an
    // empty string, which would scatter them through the middle of the list.
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;

    if (typeof a === "number" && typeof b === "number") return a - b;

    return collator.compare(String(a), String(b));
  };
}
