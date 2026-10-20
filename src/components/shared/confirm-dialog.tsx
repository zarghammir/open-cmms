"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  /** The control that opens the dialog. */
  trigger: ReactNode;
  title: string;
  /** What will happen, in plain words, including anything irreversible. */
  description: string;
  /** Label of the confirming button. Names the action, not "OK". */
  confirmLabel: string;
  destructive?: boolean;
  /**
   * What the confirming button does.
   *
   * May be asynchronous, and on this application's write paths it is: a change
   * is not finished when the repository returns, only when the browser has
   * stored it (WA-67). The dialog shows a saving state until it settles and
   * closes when it does — **unless it answers false**, which means the change
   * did not stick, and the dialog stays open behind whatever the caller has
   * shown the person. Closing on a failed write would be the screen saying the
   * work was done.
   *
   * Written as prose rather than as the type, because
   * `tests/unit/ui-strings.test.ts` reads angle brackets in a comment as markup
   * and flags the signature as a hardcoded string. Its blind spot, not a
   * defect here — and rewording is cheaper than loosening a guard that protects
   * every component in the application.
   */
  onConfirm: () => void | Promise<void | boolean>;
}

/**
 * One confirmation pattern for the whole application, so an irreversible
 * action always asks in the same way.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const tSaving = useTranslations("states.saving");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant={destructive ? "destructive" : "default"}
            disabled={saving}
            aria-busy={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  // Closing used to happen first, which was fine while every
                  // caller was synchronous and could not fail. Now that a
                  // caller waits for the browser to store the change, closing
                  // first would be the dialog announcing a result it has not
                  // got yet.
                  const stuck = await onConfirm();
                  if (stuck !== false) setOpen(false);
                } catch (error) {
                  // Rethrown out of band rather than left to float.
                  //
                  // This handler became async in WA-67, and a rejection from an
                  // async click handler reaches neither React's error boundary
                  // nor anything else — it surfaces as an unhandled rejection,
                  // which is invisible in the application and shows up only as
                  // a console error in the suites that assert a clean one. A
                  // refusal is already handled by the caller; anything reaching
                  // here is a defect and should be as loud as it was when this
                  // was synchronous.
                  setTimeout(() => {
                    throw error;
                  });
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            {saving ? tSaving("label") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
