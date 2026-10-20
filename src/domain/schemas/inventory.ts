import { z } from "zod";

/**
 * Issuing stock to a job, as a form.
 *
 * The repository refuses a quantity that is not positive and a quantity larger
 * than what is on hand. Both rules are mirrored here for one reason: a person
 * should be told which field is wrong, not thrown at. The repository stays the
 * place the rule is *enforced* — a screen is one route in, and the import and
 * every later caller meet the same answer there.
 *
 * The on-hand limit cannot be a constant, because it belongs to the part that
 * has been chosen. So the schema is a factory over the parts a person may pick
 * from, and the bound is looked up at validation time rather than baked in.
 */
export function issuePartSchema(onHandFor: (partId: string) => number | null) {
  return z
    .object({
      partId: z.string().min(1, { error: "validation.required" }),
      quantity: z
        .number({ error: "validation.required" })
        .int({ error: "validation.wholeNumber" })
        .positive({ error: "validation.positive" }),
    })
    .superRefine((value, context) => {
      const onHand = onHandFor(value.partId);
      if (onHand === null) {
        context.addIssue({
          code: "custom",
          path: ["partId"],
          message: "validation.required",
        });
        return;
      }
      if (value.quantity > onHand) {
        /*
         * Not "too large": the number that matters is how many there are, and
         * a message that does not carry it makes a person guess or open
         * another screen. The key takes the count as an argument.
         */
        context.addIssue({
          code: "custom",
          path: ["quantity"],
          message: "validation.moreThanOnHand",
        });
      }
    });
}

export type IssuePartInput = z.infer<ReturnType<typeof issuePartSchema>>;
