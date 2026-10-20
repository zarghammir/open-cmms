"use client";

import { DatabaseBackup, RotateCcw } from "lucide-react";
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
 * What a person sees when this browser could not read the records back.
 *
 * WA-58 gave that failure its own state instead of letting the boot mistake it
 * for an empty browser and seed over everything. What it left behind was a
 * skeleton with no end: on a phone in a plant room, indistinguishable from a
 * frozen application, and saying nothing about what happened or what to do.
 * A refusal only the person in the plant room can see is indistinguishable
 * from being ignored.
 *
 * Three things it has to say, and it says all three: what happened, that
 * nothing was lost, and what to do about it. The middle one matters most —
 * this state exists *because* the records are still there, and a person whose
 * first thought is that their morning's work has gone should be told otherwise
 * in the same breath.
 *
 * The control reloads the document rather than retrying in place. A retry
 * would have to rebuild the store from a page that is already holding a failed
 * read, and the honest version of that is the thing a person would do anyway.
 */
export function RecordsUnreadable() {
  const t = useTranslations("states.unreadable");

  return (
    <Empty data-slot="records-unreadable" role="status" aria-live="polite">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseBackup />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("title")}</EmptyTitle>
        <EmptyDescription>{t("body")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          size="sm"
          data-slot="records-unreadable-reload"
          onClick={() => window.location.reload()}
        >
          <RotateCcw data-icon="inline-start" />
          {t("reload")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("persists")}</p>
      </EmptyContent>
    </Empty>
  );
}
