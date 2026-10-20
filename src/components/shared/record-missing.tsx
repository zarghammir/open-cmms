"use client";

import { FileQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * An identifier that resolves to nothing.
 *
 * Deliberately not the "no matches" panel: that one says a search came back
 * empty, which is a different thing from a label in someone's hand naming a
 * record this system does not hold. It names the identifier back, because the
 * first thing anyone does is check they read it right.
 *
 * `body` overrides what to do about it, and only that. The default — check the
 * label, scan it again — is written for a tag or a stock number, which is how
 * this panel is reached three times out of four. A work-order number is not
 * labelled and not scanned: somebody followed a link, and telling them to scan
 * it is advice for a situation they are not in. The title and the naming-back
 * stay the same wherever it appears, because that part is the answer and the
 * answer does not change.
 */
export function RecordMissing({
  identifier,
  body,
  action,
}: {
  identifier: string;
  body?: string;
  action?: ReactNode;
}) {
  const t = useTranslations("records");

  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("missingTitle")}</EmptyTitle>
        <EmptyDescription>
          {body ?? t("missingBody", { identifier })}
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
