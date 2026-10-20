"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Role } from "@/domain/constants/roles";
import { useConflict } from "@/hooks/use-demo-data";

/**
 * Two versions of the same record, and a person deciding between them.
 *
 * Neither is applied until someone chooses: picking a winner automatically is
 * how the other version disappears without anybody knowing it existed. The
 * queue stops here too — replaying later changes onto a record whose state is
 * in dispute would build on an answer nobody has given.
 *
 * Both versions are labelled by where they came from rather than by "yours" and
 * "theirs" alone, because on a shared tablet in a plant room the person reading
 * this may not be the person who made the change.
 */
export function ConflictDialog({ role }: { role: Role }) {
  const t = useTranslations("offline");
  const tStatus = useTranslations("workOrderStatus");
  const format = useFormatter();
  const { conflict, keepMine, keepTheirs } = useConflict(role);

  if (!conflict) return null;

  return (
    <Dialog open>
      {/*
       * No dismiss control, deliberately. The dialog is pinned open with no
       * `onOpenChange`, so the × the content renders by default could not have
       * closed anything — it sat there at 28 by 28, enabled, named "Close", and
       * did nothing when an evaluator pressed it. An affordance that contradicts
       * the rule it is enforcing is worse than no affordance: the choice is
       * mandatory, and the screen now says so by offering only the two answers.
       */}
      <DialogContent data-slot="conflict-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {t("conflictTitle", { record: conflict.entry.label })}
          </DialogTitle>
          <DialogDescription>{t("conflictBody")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <section className="rounded-md border border-border p-3">
            <h3 className="text-sm font-medium">{t("conflictMine")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("conflictMineDetail")}
            </p>
          </section>
          <section className="rounded-md border border-border p-3">
            <h3 className="text-sm font-medium">{t("conflictTheirs")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("conflictTheirsDetail", {
                who: conflict.server.by,
                status: tStatus(conflict.server.value),
                at: format.dateTime(new Date(conflict.server.at), "time"),
              })}
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground italic">{t("simulated")}</p>

        <DialogFooter>
          <Button variant="outline" onClick={keepTheirs}>
            {t("conflictKeepTheirs")}
          </Button>
          <Button onClick={keepMine}>{t("conflictKeepMine")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
