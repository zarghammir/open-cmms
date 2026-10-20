import { z } from "zod";
import {
  CANCELLATION_REASONS,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
} from "@/domain/types/work-order";

/**
 * Validation for the forms that raise and change work orders.
 *
 * Every message is a catalogue key, not a sentence. A form renders
 * `t(issue.message)`, so the same rule reads correctly in French and a
 * wording change happens in the catalogue rather than in the schema.
 */
const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(max, { error: "validation.tooLong" });

export const workOrderCreateSchema = z.object({
  /**
   * One title, in whichever language the person raising the order works in.
   *
   * The record carries a slot per language because it is read in both, but
   * asking a technician in a mechanical room to type their request twice is
   * not bilingualism, it is friction. `contentLanguage` records what they
   * actually wrote, and nothing is translated on their behalf.
   */
  title: requiredText(120),
  description: requiredText(2000),
  contentLanguage: z.enum(["en", "fr"], { error: "validation.required" }),
  assetId: z.string().min(1, { error: "validation.assetRequired" }),
  type: z.enum(WORK_ORDER_TYPES, { error: "validation.required" }),
  priority: z.enum(WORK_ORDER_PRIORITIES, { error: "validation.required" }),
  dueOn: z.iso.date({ error: "validation.date" }).nullable(),
  estimatedMinutes: z
    .number()
    .int({ error: "validation.wholeNumber" })
    .positive({ error: "validation.positive" })
    .max(60 * 24 * 30, { error: "validation.tooLarge" })
    .nullable(),
  assignedUserId: z.string().nullable(),
});

export type WorkOrderCreateInput = z.infer<typeof workOrderCreateSchema>;

/** Everything on an update is optional; nothing on an update is unchecked. */
export const workOrderUpdateSchema = workOrderCreateSchema.partial();
export type WorkOrderUpdateInput = z.infer<typeof workOrderUpdateSchema>;

/**
 * Cancelling. The reason key is required — the whole point of the rule — and
 * the free-text note is not.
 */
export const workOrderCancelSchema = z.object({
  reasonKey: z.enum(CANCELLATION_REASONS, {
    error: "validation.reasonRequired",
  }),
  note: z.string().trim().max(500, { error: "validation.tooLong" }).nullable(),
});

export type WorkOrderCancelInput = z.infer<typeof workOrderCancelSchema>;

/**
 * Handing a work order to a person.
 *
 * One field, and it is required: the control exists to answer "who is doing
 * this", and an assignment to nobody is what the order already is. Unassigning
 * is a different act and is deliberately not this one — the repository's
 * `assign` takes a user id and cannot express it either.
 */
export const workOrderAssignSchema = z.object({
  assignedUserId: z.string().min(1, { error: "validation.required" }),
});

export type WorkOrderAssignInput = z.infer<typeof workOrderAssignSchema>;

/**
 * Completing an order.
 *
 * `actualMinutes` is still asked for — "how long did this take" is the right
 * question at the moment work finishes — but WA-39 writes the answer as a
 * labour entry for the person completing, not as a number on the order. There
 * is no stored total: `loggedMinutes` derives it from the entries, so the two
 * cannot drift apart because there is only one of them.
 *
 * WA-39 makes both required, where they were nullable. The repository refuses a
 * completion without a note or without positive minutes, and a form that
 * validated and then threw would be a rule enforced twice with only one of the
 * two saying anything a person can read. "Completed" with nothing beside it is
 * also the record a maintenance system is asked for six months later and cannot
 * answer from.
 *
 * `contentLanguage` comes with the note for the reason every typed text in this
 * product carries it: the note is somebody's own words, and a reader of the
 * other language is told so rather than handed a translation nobody wrote.
 */
export const workOrderCompleteSchema = z.object({
  actualMinutes: z
    .number()
    .int({ error: "validation.wholeNumber" })
    .positive({ error: "validation.positive" })
    .max(60 * 24 * 30, { error: "validation.tooLarge" }),
  note: requiredText(2000),
  contentLanguage: z.enum(["en", "fr"], { error: "validation.required" }),
});

/**
 * The same form, asked of an organisation that has made the note optional.
 *
 * **WA-112 turned one rule into two enforcement points that could disagree.**
 * The docblock above says the note is required in the schema *and* in the
 * repository on purpose, so that a person is told what is wrong rather than
 * meeting an exception — and that is still right. What changed is that the
 * answer now comes from a record, so both places have to read the same record
 * or the switch governs half the application.
 *
 * It failed exactly that way first: the repository honoured the rule, the form
 * did not, and turning the rule off changed nothing a person could do. The
 * browser test's positive half is what found it — "the dialog stayed open" was
 * true either way, and only asking the switch to actually let something
 * through told the two apart.
 */
export function workOrderCompleteSchemaFor(requireNote: boolean) {
  return requireNote
    ? workOrderCompleteSchema
    : workOrderCompleteSchema.extend({
        note: z.string().trim().max(2000, { error: "validation.tooLong" }),
      });
}

export type WorkOrderCompleteInput = z.infer<typeof workOrderCompleteSchema>;
