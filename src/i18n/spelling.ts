/**
 * The British spellings Canadian English does not use, and the detector for them.
 *
 * Lifted out of `messages.test.ts` (WA-86) so the catalogue sweep and the seed
 * sweep read one list. Two copies would agree until somebody added a word to
 * one of them, and the half that missed it would keep passing — which is the
 * failure this list exists to prevent, one level up.
 *
 * **A list of whole words, not a pattern over word endings, and that is a
 * measurement rather than a preference.** The obvious implementation,
 * `/\B(is|IS)(e|ed|es|ing|ation)\b/`, fires on 24 values in the English
 * catalogue of which 19 are inflections of "raise": `\B` matches inside a word,
 * so "raised" ends in something that looks like `-ise`. A check that cries wolf
 * nineteen times out of twenty-four is a check the next person silences.
 *
 * **Deliberately not on the list.** Canadian English keeps `centre`, `licence`,
 * `defence`, `catalogue`, `dialogue` and the `-our` family. The `-ise` family is
 * the one place Canadian and British usage actually part company. The American
 * forms are left alone too: catching those is a different check and nothing here
 * needs one.
 */
export const BRITISH_SPELLINGS = [
  "organisation",
  "organisations",
  "organise",
  "organised",
  "organises",
  "organising",
  "synchronisation",
  "synchronise",
  "synchronised",
  "recognise",
  "recognised",
  "recognises",
  "recognising",
  "sanitise",
  "sanitised",
  "sanitises",
  "sanitisation",
  "deionisation",
  "prioritise",
  "prioritised",
  "customise",
  "customised",
  "initialise",
  "initialised",
  "authorise",
  "authorised",
  "analyse",
  "analysed",
  "analyses",
  "utilise",
  "utilised",
  "utilisation",
  "aluminium",
] as const;

/** The detector itself, so a test can check the thing it is using. */
export const britishSpelling = new RegExp(
  `\\b(?:${BRITISH_SPELLINGS.join("|")})\\b`,
  "i",
);
