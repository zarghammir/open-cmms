import type { ScanKind } from "./scan";

/** Everything one printed label shows. Assembled by `useLabelContent`. */
export interface LabelContent {
  kind: ScanKind;
  /** The tag or stock number, the thing people read out loud. */
  identifier: string;
  name: string;
  /** Room code for an asset, bin code for a part. */
  placeCode: string;
  placeName: string;
  /** The absolute URL the QR carries, or null while the origin is unknown. */
  url: string | null;
}

/**
 * Looking a label up has three answers, not two.
 *
 * `unknown` is the moment before the browser has read the records back: there
 * is no record *and no answer*, and a screen that drew "no such asset" then
 * would be telling a technician something untrue about a label they are
 * holding in their hand.
 */
export type LabelLookup =
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "found"; content: LabelContent };
