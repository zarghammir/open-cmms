"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { can, type Capability, type Role } from "@/domain/constants/roles";

/**
 * A page action gated by a capability. When the role does not hold the
 * capability the control stays visible but disabled, and says why: hiding it
 * would leave someone wondering whether the feature exists.
 *
 * The disabled button sits inside a focusable wrapper, because a disabled
 * button cannot take focus and the explanation has to be reachable by
 * keyboard.
 *
 * The icon arrives as an element, not as a component: a server page renders
 * this client component, and a function cannot cross that boundary. For the
 * same reason `focusTargetId` is an element id rather than a handler: where the
 * thing being started already exists on the page, the button moves focus to it.
 * Without one, the button says the screen is not built yet, which is only true
 * while it is.
 *
 * `children` is WA-39's addition, and it is what lets a control that actually
 * does something be gated by the same component. Pass a button or a dialog
 * trigger and it is rendered when the role holds the capability; leave it out
 * and the original behaviour stands.
 *
 * The point of routing them through here rather than writing `can(...) ? x :
 * null` at each call site is the **denied** branch. A control that is hidden
 * leaves someone wondering whether the feature exists; a control that is
 * present, disabled and says which role they are holding tells them the answer.
 * That sentence lives in one place, and a screen cannot forget it by writing
 * the easy version of the conditional.
 */
export function CapabilityAction({
  role,
  capability,
  label,
  icon,
  focusTargetId,
  children,
}: {
  role: Role;
  capability: Capability;
  label: string;
  icon: ReactNode;
  /** Id of the control to focus, for an action whose form is already here. */
  focusTargetId?: string;
  /** The control to render when the role holds the capability. */
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  const tRoles = useTranslations("roles");
  const tPermissions = useTranslations("permissions");
  const allowed = can(role, capability);

  if (!allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot="capability-action"
            tabIndex={0}
            className="inline-flex rounded-sm"
          >
            <Button size="sm" disabled aria-disabled="true">
              {icon}
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {tPermissions("actionDenied", {
            role: tRoles(`${role}.name`),
          })}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (children) return <>{children}</>;

  return (
    <Button
      size="sm"
      onClick={() => {
        if (!focusTargetId) {
          toast.info(t("notBuiltYet"));
          return;
        }
        const target = document.getElementById(focusTargetId);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        target?.focus({ preventScroll: true });
      }}
    >
      {icon}
      {label}
    </Button>
  );
}
