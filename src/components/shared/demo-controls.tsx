"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CapabilityAction } from "@/components/shared/capability-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can, type Role } from "@/domain/constants/roles";
import { useDemoReset } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import { DEMO_ROLE_COOKIE } from "@/lib/demo-session";
import { useRouter } from "@/i18n/navigation";
import { defaultLocale } from "@/i18n/routing";

const CLEARED_COOKIES = [DEMO_ROLE_COOKIE, "sidebar_state", "NEXT_LOCALE"];

/**
 * Puts the demonstration back to its starting state: the records are rebuilt
 * for today and the interface returns to English, the Administrator role and
 * an expanded module rail.
 *
 * Rebuilding is safe because the records only ever lived in this browser. The
 * reset writes itself into the audit trail rather than leaving a gap, so the
 * trail says what happened to the records it is describing.
 */
export function DemoControls({ role }: { role: Role }) {
  const t = useTranslations("demo");
  const router = useRouter();
  const resetDemo = useDemoReset(role);
  const { save } = useSaving();

  async function reset(): Promise<boolean> {
    /*
     * The write, then the navigation, in that order — and this is the surface
     * WA-67 was most exposed on.
     *
     * It rebuilt every record and called `router.replace` in the next
     * statement, which is the defect's shape exactly: a write still in flight
     * when the document is torn down. Measured on the same shape, a change
     * left alone was stored 40 times in 40 and the same change across a
     * teardown was lost 32 times in 40. Here the whole demonstration is the
     * change, so losing it means a reset that silently did not reset.
     */
    const { stored } = await save(() => {
      resetDemo();
    });
    // Answering false keeps the confirmation open behind the standing message,
    // rather than closing on a reset that did not reach the device.
    if (!stored) return false;

    for (const name of CLEARED_COOKIES) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }

    router.replace("/", { locale: defaultLocale });
    router.refresh();
    toast.success(t("done"));
    return true;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-2">
        {can(role, "demo.reset") ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <RotateCcw data-icon="inline-start" />
                {t("reset")}
              </Button>
            }
            title={t("confirmTitle")}
            description={t("confirmBody")}
            confirmLabel={t("confirmAction")}
            onConfirm={reset}
          />
        ) : (
          // Settings is only open to roles that hold this capability today, so
          // this branch is a guard rather than a screen anyone reaches. It is
          // here because the role table is allowed to change and a reset that
          // silently worked for a role that may not reset would be worse than
          // a disabled button that says why.
          <CapabilityAction
            role={role}
            capability="demo.reset"
            label={t("reset")}
            icon={<RotateCcw data-icon="inline-start" />}
          />
        )}
        <p className="text-xs text-muted-foreground">{t("dataNote")}</p>
      </CardContent>
    </Card>
  );
}
