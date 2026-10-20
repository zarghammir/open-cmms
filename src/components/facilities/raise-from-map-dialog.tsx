"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CapabilityAction } from "@/components/shared/capability-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateWorkOrderForm } from "@/components/work-orders/create-work-order-form";
import type { Role } from "@/domain/constants/roles";
import type { Asset } from "@/domain/types";

/**
 * Raising work against the machine a person has just pointed at on the plan.
 *
 * **The map is where the problem is noticed, so it is where the order starts.**
 * Sending somebody to the work-order screen to choose the same machine out of a
 * list of sixty, having just clicked it on a drawing, is the step that makes a
 * demonstration look like a form-filling exercise.
 *
 * **The dialog closes when the order is stored, not when it is submitted.** The
 * form calls back on its `stored` branch only — the same durability signal
 * `issue-part-dialog` uses — so a device that is refusing to store keeps the
 * dialog open with the words still in it.
 *
 * **The form is the one from the work-order screen, not a second one.** A
 * compact "just a title and a priority" version would be a second description
 * of what an order is, and the two would disagree the first time a field was
 * added. Its own heading is what the dialog shows; the dialog's title is there
 * for the accessible name, which is why it is not drawn twice.
 *
 * Gated by `CapabilityAction`, so a role that may not raise work sees the
 * control, disabled, with the reason — an auditor reading the map learns that
 * the product is role-based rather than that the button is missing.
 */
export function RaiseFromMapDialog({
  asset,
  role,
}: {
  asset: Asset;
  role: Role;
}) {
  const t = useTranslations("floorMap");
  const [open, setOpen] = useState(false);

  return (
    <CapabilityAction
      role={role}
      capability="workOrder.create"
      label={t("raiseAction")}
      icon={<Plus data-icon="inline-start" />}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus data-icon="inline-start" />
            {t("raiseAction")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {t("raiseDialogTitle", { tag: asset.assetTag })}
            </DialogTitle>
            <DialogDescription>{t("raiseDialogDescription")}</DialogDescription>
          </DialogHeader>
          <CreateWorkOrderForm
            role={role}
            presetAssetTag={asset.assetTag}
            onRaised={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </CapabilityAction>
  );
}
