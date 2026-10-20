"use client";

import { OctagonAlert, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Shown by an error boundary. It states that nothing was changed, because the
 * first question after a failure is always "did it save?".
 */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("states.error");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <OctagonAlert />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("title")}</EmptyTitle>
        <EmptyDescription>{t("body")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          {t("action")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
