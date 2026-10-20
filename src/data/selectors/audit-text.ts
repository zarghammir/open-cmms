import {
  PRIORITY_NAMESPACE,
  REASON_NAMESPACE,
  ROLE_NAMESPACE,
  STATUS_NAMESPACE,
  type AuditPhrase,
} from "@/lib/audit-summary";

/**
 * Turns an audit entry's arguments into text a person can read.
 *
 * Most arguments are literals — a work-order number, a surname. One is not:
 * `status` holds a domain value such as `waitingForParts`, because an audit
 * entry written in English in August still has to read correctly in French in
 * October. Rendering it raw would put `waitingForParts` in the middle of a
 * sentence, in both languages.
 *
 * This is the piece that stops that happening, rather than a note in a
 * document asking the next screen to remember. A screen calls it and passes
 * the result to `t(event.summaryKey, params)`.
 */

/** Arguments whose value is a catalogue key, and where that key lives. */
const KEY_VALUED_PARAMS: Record<
  string,
  ((value: string) => string) | undefined
> = {
  status: (value) => `${STATUS_NAMESPACE}${value}`,
  // Same shape, same reason. A cancellation stores `duplicate`, and a trail
  // reading "WO-2026-0041 cancelled: duplicate" is the raw value in the middle
  // of a sentence — in both languages, which is the half that makes it a
  // defect rather than a wording preference.
  reason: (value) => `${REASON_NAMESPACE}${value}`,
  /*
   * WA-124. A role stored in the trail is `maintenanceCoordinator`, which is
   * not a word in either language — the same reason `status` is here. The
   * site arrives as a code (KGN, MCT), which is already one word in both and
   * is what people say out loud, so it stays a literal.
   */
  fromRole: (value) => `${ROLE_NAMESPACE}${value}.name`,
  toRole: (value) => `${ROLE_NAMESPACE}${value}.name`,
  /*
   * WA-112's rule changes. Deliberately named `fromStatus` and `toStatus`
   * rather than `from` and `to`: those two words are already the field names
   * inside a `FieldChange`, and a param that shares a name with something else
   * in the same record is a collision waiting for somebody to reuse it. The
   * same reasoning gives the target its own `slaPriority`.
   */
  fromStatus: (value) => `${STATUS_NAMESPACE}${value}`,
  toStatus: (value) => `${STATUS_NAMESPACE}${value}`,
  slaPriority: (value) => `${PRIORITY_NAMESPACE}${value}`,
};

export function auditSummaryParams(
  event: AuditPhrase,
  translate: (key: string) => string,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  for (const [name, value] of Object.entries(event.summaryParams)) {
    const toKey = KEY_VALUED_PARAMS[name];
    params[name] =
      toKey && typeof value === "string" ? translate(toKey(value)) : value;
  }

  return params;
}
