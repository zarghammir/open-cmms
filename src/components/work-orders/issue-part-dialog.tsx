"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackageMinus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CapabilityAction } from "@/components/shared/capability-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/work-orders/field";
import type { Role } from "@/domain/constants/roles";
import {
  issuePartSchema,
  type IssuePartInput,
} from "@/domain/schemas/inventory";
import type { WorkOrder } from "@/domain/types";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import { textFor } from "@/lib/localized-text";

/**
 * Taking a part out of the store and onto this job.
 *
 * WA-39 shipped `parts.issue` with its own tests and no way to reach it: until
 * this dialog, the only caller in the repository was a test. A write path a
 * person cannot reach is a claim in a bid that nobody can demonstrate.
 *
 * **A dialog rather than a drawer.** The `shadcn` skill points at `Drawer` for a
 * bottom sheet at phone width and it would be the better shape there, but this
 * repository vendors no Drawer and AGENTS.md forbids adding registry
 * components. `Dialog` is vendored, already carries the focus trap and the
 * labelled title, and at 390 it fills the screen anyway. Named here so a
 * reviewer running that skill sees a decision rather than an oversight.
 *
 * **The count is in the option, not only in the error.** Each part reads
 * "FLT-2101 — Filter (12 on hand)", so the limit is visible while somebody is
 * choosing rather than after they have guessed wrong. The refusal still exists
 * — the schema mirrors it and the repository enforces it — but a form whose
 * only way of telling you the bound is to reject you is a form that makes
 * people guess.
 */
export function IssuePartDialog({
  order,
  role,
}: {
  order: WorkOrder;
  role: Role;
}) {
  const t = useTranslations("workOrderDetail.write.issuePart");
  const tValidation = useTranslations("validation");
  const locale = useLocale();
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const [open, setOpen] = useState(false);

  /*
   * This site's stock, and only what there is any of. A part with none on hand
   * cannot be issued, so offering it would be offering a refusal.
   */
  const available = useMemo(
    () =>
      (repositories?.parts.list(order.facilityId) ?? []).filter(
        (part) => part.quantityOnHand > 0,
      ),
    [repositories, order.facilityId],
  );

  const form = useForm<IssuePartInput>({
    resolver: zodResolver(
      issuePartSchema(
        (partId) =>
          available.find((part) => part.id === partId)?.quantityOnHand ?? null,
      ),
    ),
    defaultValues: { partId: available[0]?.id ?? "", quantity: 1 },
    mode: "onSubmit",
  });

  // Which part is selected now, so the hint under the control can say how many
  // there are of it.
  const chosen = available.find((part) => part.id === form.watch("partId"));

  async function onSubmit(values: IssuePartInput) {
    if (!repositories) return;
    const part = available.find((candidate) => candidate.id === values.partId);
    if (!part) return;

    const { stored } = await save(() => {
      repositories.parts.issue(part.id, values.quantity, order.id, actor);
    });
    if (!stored) return;
    toast.success(
      t("done", {
        quantity: values.quantity,
        partNumber: part.partNumber,
        number: order.number,
      }),
    );
    setOpen(false);
    form.reset();
  }

  function message(key: string | undefined) {
    if (!key) return undefined;
    const short = key.replace(/^validation\./, "");
    return tValidation(short as Parameters<typeof tValidation>[0]);
  }

  return (
    <CapabilityAction
      role={role}
      capability="inventory.issue"
      label={t("action")}
      icon={<PackageMinus data-icon="inline-start" />}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <PackageMinus data-icon="inline-start" />
            {t("action")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title", { number: order.number })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {available.length === 0 ? (
            // The third state: a store that has been read and holds nothing
            // issuable is not the same as one nobody has looked at.
            <p className="text-sm text-muted-foreground">{t("noneInStock")}</p>
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3"
            >
              <Field
                id="wo-issue-part"
                label={t("part")}
                /*
                  The count again, under the control rather than only inside it.

                  It is in the option text too — but a native select is as wide
                  as the field, not as wide as its longest option, so at 390 the
                  option reads "WTR-223 — Cartouche de résine de déionisation ("
                  and the number is past the edge. The count is the whole reason
                  it is there: a person choosing should see the bound before
                  they type a quantity, not after the form refuses one. A hint
                  is visible whatever the width, and follows the selection.
                */
                hint={
                  chosen
                    ? t("onHand", { onHand: chosen.quantityOnHand })
                    : undefined
                }
                error={message(form.formState.errors.partId?.message)}
              >
                {(props) => (
                  <Select {...props} {...form.register("partId")}>
                    {available.map((part) => (
                      <option key={part.id} value={part.id}>
                        {t("option", {
                          partNumber: part.partNumber,
                          name: textFor(part.name, locale),
                          onHand: part.quantityOnHand,
                        })}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                id="wo-issue-quantity"
                label={t("quantity")}
                error={message(form.formState.errors.quantity?.message)}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="h-11"
                    {...form.register("quantity", { valueAsNumber: true })}
                  />
                )}
              </Field>
              <DialogFooter>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? tSaving("label") : t("submit")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </CapabilityAction>
  );
}
