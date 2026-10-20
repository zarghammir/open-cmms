"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RecordLabel } from "@/components/shared/record-label";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import { useLabelContent } from "@/hooks/use-label-content";
import type { ScanKind } from "@/lib/scan";

/**
 * The label for one record, with the button that prints it.
 *
 * Printing is the browser's own print dialogue against a print stylesheet
 * rather than a generated PDF. It adds no dependency, it gives "Save as PDF"
 * for free on every platform the RFP names, and what comes out of the printer
 * is the same markup a reviewer can already see on the screen.
 *
 * WA-10 mounts this as the Label tab on the asset page; until then it is a
 * route of its own and a scan resolves straight to it.
 */
export function LabelScreen({
  kind,
  identifier,
}: {
  kind: ScanKind;
  identifier: string;
}) {
  const t = useTranslations("label");
  const lookup = useLabelContent(kind, identifier);

  if (lookup.state === "unknown") {
    return <LoadingState rows={2} />;
  }

  if (lookup.state === "missing") {
    return <RecordMissing identifier={identifier} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-print-hidden className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          {t("print")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("printHint")}</p>
      </div>

      <div data-print-region className="flex justify-center sm:justify-start">
        <RecordLabel content={lookup.content} />
      </div>
    </div>
  );
}
