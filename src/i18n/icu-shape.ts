import {
  TYPE,
  parse,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

/**
 * The structure of an ICU message, as a set of facts that a translation must
 * reproduce exactly.
 *
 * The point of describing a message this way rather than comparing argument
 * names is that every fact carries the branch it was found in. `{who}` present
 * in a plural's `other` branch and missing from its `one` branch is two
 * different facts, so the comparison sees the gap, and the failure can name the
 * branch a translator has to go and look at.
 *
 * What a fact does *not* record is any text: `# day` and `# jour` produce the
 * same facts, which is the whole point — the French is meant to differ.
 */
export type IcuShape = ReadonlySet<string>;

export interface IcuShapeDifference {
  /** Facts the English message has and the French one does not. */
  readonly missingInFrench: readonly string[];
  /** Facts the French message has and the English one does not. */
  readonly addedInFrench: readonly string[];
}

/**
 * Why this is hand-written rather than `isStructurallySame` from the same
 * package: that function collects variables into one flat map keyed by name and
 * compares the names and their types. It never records which branch a variable
 * appeared in and it ignores `#` entirely, so it returns success for a French
 * plural that drops `{who}` from one branch, for one that drops `#` from a
 * branch, for one that moves `#` between branches, and for one that loses a
 * whole `=0` branch. `icu-shape.test.ts` measures that rather than asserting it
 * from this paragraph, so the day the library closes the gap the test says so.
 */
function describeElements(
  elements: readonly MessageFormatElement[],
  scope: string,
  facts: Set<string>,
): void {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
        facts.add(`${scope}{${element.value}}`);
        break;

      case TYPE.number:
        facts.add(`${scope}{${element.value}} formatted as a number`);
        break;

      case TYPE.date:
        facts.add(`${scope}{${element.value}} formatted as a date`);
        break;

      case TYPE.time:
        facts.add(`${scope}{${element.value}} formatted as a time`);
        break;

      case TYPE.pound:
        // A `#` belongs to the branch it sits in. Recording it against the
        // scope is what makes moving one between branches visible: the fact
        // disappears from one branch and appears in another rather than
        // cancelling out in a total.
        facts.add(`${scope}#`);
        break;

      case TYPE.plural: {
        facts.add(
          `${scope}{${element.value}} is a ${element.pluralType} plural`,
        );
        if (element.offset !== 0) {
          facts.add(`${scope}{${element.value}} has offset ${element.offset}`);
        }
        for (const [branch, option] of Object.entries(element.options)) {
          facts.add(`${scope}{${element.value}} has branch "${branch}"`);
          describeElements(
            option.value,
            `${scope}{${element.value}} "${branch}" > `,
            facts,
          );
        }
        break;
      }

      case TYPE.select: {
        facts.add(`${scope}{${element.value}} is a select`);
        for (const [branch, option] of Object.entries(element.options)) {
          facts.add(`${scope}{${element.value}} has branch "${branch}"`);
          describeElements(
            option.value,
            `${scope}{${element.value}} "${branch}" > `,
            facts,
          );
        }
        break;
      }

      case TYPE.tag: {
        facts.add(`${scope}<${element.value}>`);
        describeElements(
          element.children,
          `${scope}<${element.value}> > `,
          facts,
        );
        break;
      }

      case TYPE.literal:
        // Text is the part that is supposed to differ between languages.
        break;
    }
  }
}

/**
 * Parses a message and returns its structural facts.
 *
 * Throws on a message ICU cannot parse. That is deliberate: a message that does
 * not parse has no shape, and returning an empty set would make an unparseable
 * message compare equal to another unparseable one. An unreadable message is
 * unknown, not empty.
 */
export function describeIcuShape(message: string): IcuShape {
  const facts = new Set<string>();
  describeElements(parse(message), "", facts);
  return facts;
}

/**
 * The facts on which two messages disagree. Empty on both sides means the
 * French message can be given the same arguments as the English one and will
 * use them in the same places.
 */
export function compareIcuShapes(
  english: string,
  french: string,
): IcuShapeDifference {
  const englishFacts = describeIcuShape(english);
  const frenchFacts = describeIcuShape(french);

  return {
    missingInFrench: [...englishFacts]
      .filter((fact) => !frenchFacts.has(fact))
      .sort(),
    addedInFrench: [...frenchFacts]
      .filter((fact) => !englishFacts.has(fact))
      .sort(),
  };
}

/** Whether two messages agree on every structural fact. */
export function icuShapesAgree(difference: IcuShapeDifference): boolean {
  return (
    difference.missingInFrench.length === 0 &&
    difference.addedInFrench.length === 0
  );
}

/**
 * A failure a translator can act on: which key, and which branch of it.
 */
export function formatIcuShapeDifference(
  key: string,
  difference: IcuShapeDifference,
): string {
  const lines = [`${key}: the French message has a different ICU structure`];

  for (const fact of difference.missingInFrench) {
    lines.push(`  missing in French: ${fact}`);
  }
  for (const fact of difference.addedInFrench) {
    lines.push(`  only in French:    ${fact}`);
  }

  return lines.join("\n");
}
