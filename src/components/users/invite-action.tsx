"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Invite a person — present, disabled, and saying why.
 *
 * **Deliberately not `CapabilityAction`, and the reason is worth reading
 * before anybody "fixes" it.** That component gates on `can(role, capability)`,
 * and this screen is reachable by the administrator alone — who holds every
 * capability there is. Routed through it, the denied branch could never render
 * here, so the control would appear enabled and do nothing. The reason this one
 * is unavailable is the **phase**, not the role.
 *
 * It stays visible because a demonstration has to show that the feature is
 * planned rather than missing: an absent button tells an evaluator nothing, and
 * the thing they are assessing is the product's shape as much as its state
 * today. Same argument as every capability-gated control, arrived at for a
 * different reason.
 *
 * The disabled button sits inside a focusable wrapper, because a disabled
 * button cannot take focus and the explanation has to be reachable from the
 * keyboard.
 */
export function InviteAction() {
  const t = useTranslations("users");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot="phase-action"
          tabIndex={0}
          className="inline-flex rounded-sm"
        >
          <Button size="sm" disabled aria-disabled="true">
            <UserPlus data-icon="inline-start" />
            {t("invite.label")}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("invite.unavailable")}</TooltipContent>
    </Tooltip>
  );
}
