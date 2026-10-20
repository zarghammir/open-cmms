"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { whenFlushed } from "@/stores/idb-storage";

/**
 * Makes a change, and does not call it done until it is stored.
 *
 * A repository write updates memory and returns, so the screen could draw the
 * result — and say "Cancelled" — before a byte had reached the browser's
 * database. WA-67 measured what that costs: a change made and then left alone
 * was stored 40 times in 40, and the same change with the page torn down
 * underneath it was lost 32 times in 40. In every one of those the person had
 * already been told it was saved.
 *
 * So the success message moves behind `whenFlushed()`, and the wait is visible:
 * the control says it is saving rather than only going quiet, because a
 * disabled button is not a statement about anything.
 *
 * This does not stop a reload from killing a write that is still in flight —
 * nothing can, the browser does not ask permission. What it does is stop the
 * screen claiming the change was saved when it was not, and, because writes are
 * now serialised, hold the loss to the one change still in the air rather than
 * everything since the last write that happened to commit.
 *
 * The failure message is here rather than at each call site on purpose: one
 * wording, shown the same way everywhere, and it does not disappear on a timer.
 * A change that is on screen and not on the device is worth interrupting for.
 */
/**
 * The outcome of a change: whether the browser stored it, and what it produced.
 *
 * A discriminated pair rather than a boolean beside a nullable value, so a
 * caller cannot read the record out of a change that was not saved.
 */
export type Saved<T> = { stored: true; value: T } | { stored: false };

export function useSaving() {
  const t = useTranslations("states.saving");
  const [saving, setSaving] = useState(false);

  /**
   * Runs `change`, waits for the browser to store it, and answers whether it
   * did — carrying out whatever `change` returned, so a caller that needs the
   * new record's number does not have to reach around the closure for it.
   *
   * A refusal thrown by `change` — a status move the rules do not allow —
   * travels on to the caller, which is where refusals are already handled.
   */
  const save = useCallback(
    async <T>(change: () => T): Promise<Saved<T>> => {
      setSaving(true);
      try {
        const value = change();
        const stored = await whenFlushed();
        if (!stored) {
          toast.error(t("failedTitle"), {
            description: t("failedBody"),
            // Stays until it is dismissed. The record of a failed write cannot
            // itself be written — a device that cannot save cannot save the
            // note saying so — so being seen in this session is the whole of
            // the guarantee, and four seconds is not enough of it.
            duration: Number.POSITIVE_INFINITY,
          });
          return { stored: false };
        }
        return { stored: true, value };
      } finally {
        setSaving(false);
      }
    },
    [t],
  );

  return { saving, save };
}
