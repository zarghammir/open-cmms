"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A status move an administrator has switched off: present, disabled, saying so.
 *
 * **Not `CapabilityAction`, and the difference is the whole point.** That
 * component answers "may *you* do this", and its sentence names the role the
 * reader is holding. This one answers "may *anybody* do this here", and its
 * sentence names the rule. A technician shown "maintenance coordinator cannot
 * do this" when what is true is that the organisation turned the move off
 * would go looking for a permission that was never the problem.
 *
 * **Not hidden**, which is the 2026-09-16 ruling and the reason this file
 * exists at all. A screen that silently gets shorter demonstrates nothing: an
 * evaluator switching a rule off in Settings has to be able to see the control
 * change rather than vanish, and a technician has to be told why the button
 * they used yesterday no longer works.
 *
 * The disabled button sits inside a focusable wrapper because a disabled
 * button cannot take focus, and the explanation has to be reachable from the
 * keyboard. That is the third copy of this shape in the codebase —
 * `CapabilityAction` and `InviteAction` hold the other two — and it is worth a
 * shared component the next time one is needed rather than now, in a ticket
 * that would then be changing a control on every screen.
 */
export function RuleBlockedAction({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  const t = useTranslations("workOrderStatus");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot="rule-blocked-action"
          tabIndex={0}
          className="inline-flex rounded-sm"
        >
          <Button size="sm" variant="outline" disabled aria-disabled="true">
            {icon}
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("refusedByRule")}</TooltipContent>
    </Tooltip>
  );
}
