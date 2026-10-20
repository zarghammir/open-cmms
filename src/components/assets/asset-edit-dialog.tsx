"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Role } from "@/domain/constants/roles";
import { assetCreateSchema } from "@/domain/schemas/asset";
import { useSaving } from "@/hooks/use-saving";
import {
  ASSET_CRITICALITIES,
  ASSET_STATUSES,
  type Asset,
} from "@/domain/types/asset";
import { useUpdateAsset } from "@/hooks/use-asset";

/**
 * Changing what this system records about a piece of equipment.
 *
 * Deliberately narrow. The tag is the address a printed label resolves to and
 * changing it would strand every sticker already on a wall; the type and the
 * location are structural; and the name is held in both languages on the
 * record, so editing it is editing a translation — ruled out of Phase 1 rather
 * than half-answered here.
 *
 * What is left is what a facility manager actually revises: how critical the
 * machine is, whether it is still in service, and the plate details someone
 * mistyped.
 *
 * A form submitted unchanged writes nothing and says so. The alternative is an
 * audit entry recording that an asset was updated, listing no change.
 */
type EditableFields = Pick<
  Asset,
  "status" | "criticality" | "manufacturer" | "model" | "serialNumber"
>;

/*
 * Picked from the create schema, not the update one. `assetUpdateSchema` is a
 * partial, so every field on it is optional — and a form whose resolver says
 * "this may be absent" while its own type says "this is a string" is a mismatch
 * the compiler catches and a reader would not. These five fields are always
 * present on the form; whether they differ from the record is a separate
 * question, answered in `useUpdateAsset`.
 */
const editSchema = assetCreateSchema.pick({
  status: true,
  criticality: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
});

export function AssetEditDialog({ asset, role }: { asset: Asset; role: Role }) {
  const t = useTranslations("assetDetail.edit");
  const tStatus = useTranslations("assetStatus");
  const tCriticality = useTranslations("criticality");
  const tValidation = useTranslations("validation");
  const [open, setOpen] = useState(false);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const updateAsset = useUpdateAsset(role);

  const defaults: EditableFields = {
    status: asset.status,
    criticality: asset.criticality,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
  };

  const form = useForm<EditableFields>({
    resolver: zodResolver(editSchema),
    defaultValues: defaults,
  });

  async function submit(values: EditableFields) {
    const result = await save(() => updateAsset(asset.id, values));
    // Still open, still holding what was typed: a dialog that closed here
    // would be the screen saying the edit was kept.
    if (!result.stored) return;
    toast.success(result.value ? t("saved") : t("nothingChanged"));
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    // Reopening shows the record as it is now, not as it was when the dialog
    // was last closed — otherwise a cancelled edit quietly becomes the starting
    // point for the next one.
    if (next) form.reset(defaults);
    setOpen(next);
  }

  // `useWatch` rather than `form.watch()`: the latter hands back a fresh
  // function on every render, so React Compiler refuses to memoise anything
  // that touches it and says so in the lint. This subscribes to the two fields
  // the toggles render and nothing else.
  const status = useWatch({ control: form.control, name: "status" });
  const criticality = useWatch({ control: form.control, name: "criticality" });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Pencil data-icon="inline-start" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(submit)}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description", { tag: asset.assetTag })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">{t("status")}</legend>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={status}
                onValueChange={(value) =>
                  value && form.setValue("status", value as Asset["status"])
                }
              >
                {ASSET_STATUSES.map((option) => (
                  <ToggleGroupItem key={option} value={option}>
                    {tStatus(option)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">
                {t("criticality")}
              </legend>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={criticality}
                onValueChange={(value) =>
                  value &&
                  form.setValue("criticality", value as Asset["criticality"])
                }
              >
                {ASSET_CRITICALITIES.map((option) => (
                  <ToggleGroupItem key={option} value={option}>
                    {tCriticality(option)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("manufacturer")}
              <Input {...form.register("manufacturer")} />
              {errors.manufacturer?.message ? (
                <span role="alert" className="text-xs text-destructive">
                  {tValidation(errors.manufacturer.message as "tooLong")}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("model")}
              <Input {...form.register("model")} />
              {errors.model?.message ? (
                <span role="alert" className="text-xs text-destructive">
                  {tValidation(errors.model.message as "tooLong")}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("serialNumber")}
              <Input className="font-mono" {...form.register("serialNumber")} />
              {errors.serialNumber?.message ? (
                <span role="alert" className="text-xs text-destructive">
                  {tValidation(errors.serialNumber.message as "tooLong")}
                </span>
              ) : null}
            </label>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? tSaving("label") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
