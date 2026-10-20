import { CAPABILITIES, ROLES, can, type Capability, type Role } from "./roles";

/**
 * The role table, generated from the rule the buttons obey.
 *
 * The solicitation asks for administrator configuration of users and roles, and
 * an evaluator wants to read who may do what. The rule already exists and is
 * already enforced — `can(role, capability)` is what every gated control asks —
 * so the only honest way to show it is to ask the same question and print the
 * answers.
 *
 * **Nothing here is a second description of the rule.** A table written out by
 * hand would be a second description, and the day somebody adds a capability it
 * would quietly become a wrong one: the screen would say a role cannot do
 * something the buttons let it do, which is worse than no screen, because a
 * person would believe it. That is the drift this exists to make impossible
 * rather than to detect.
 *
 * What the words are is a different question, and the catalogue answers it:
 * `roleTable.capability.<name>` in both languages. A capability with no words
 * is a compile error through the typed message keys and a red test through the
 * one below it, so a new one cannot reach a screen as a bare identifier.
 */

export interface RoleMatrixRow {
  capability: Capability;
  /** One answer per role, in `ROLES` order, so a column is a role. */
  allowed: readonly boolean[];
}

export function roleMatrix(): RoleMatrixRow[] {
  return CAPABILITIES.map((capability) => ({
    capability,
    allowed: ROLES.map((role: Role) => can(role, capability)),
  }));
}

/**
 * Whether a role may do nothing at all, for the sentence beside its column.
 *
 * `isReadOnly` says the same thing and says it as a fact about the rule; this
 * is here so a screen does not have to know that an empty row means "reads".
 */
export function readsOnly(role: Role): boolean {
  return CAPABILITIES.every((capability) => !can(role, capability));
}
