"use client";

import { HardDriveDownload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDurable } from "@/hooks/use-demo-data";

/**
 * Says so when this browser has stopped keeping what it is told.
 *
 * A per-change message is shown at the moment a write fails, but it is a toast
 * and a person can miss it or dismiss it and carry on working — filling in a
 * count sheet on a device that is quietly discarding every entry. This stays on
 * the screen for as long as the condition does.
 *
 * Three states, and the middle one is why this is a component rather than a
 * boolean: `null` is "nothing has been read or written yet", which is not
 * "yes". Silent for `null` and for `true`; a banner that appears before anyone
 * has asked the device anything would be a warning about nothing, and a banner
 * that is always there is one nobody reads.
 */
export function NotSavingBanner() {
  const t = useTranslations("states.saving");
  const durable = useDurable();

  if (durable !== false) return null;

  return (
    <Alert
      data-slot="not-saving-banner"
      variant="destructive"
      role="status"
      aria-live="polite"
    >
      <HardDriveDownload aria-hidden="true" />
      <AlertTitle>{t("deviceTitle")}</AlertTitle>
      <AlertDescription>{t("deviceBody")}</AlertDescription>
    </Alert>
  );
}
