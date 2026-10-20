"use client";

import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanPanel } from "@/components/shared/scan-panel";
import { LoadingState } from "@/components/shared/state-panels";
import { can, type Role } from "@/domain/constants/roles";
import { hasRecords, useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import { resolveLocale } from "@/i18n/routing";
import { textFor } from "@/lib/localized-text";
import type { ScanResult } from "@/lib/scan";

/**
 * Inventory verification: scan what is on the shelf, say what you counted.
 *
 * A count that agrees with the record is still worth recording on the sheet —
 * the person checked it — but it writes no stock movement, because confirming
 * a number is not a movement. Only a difference reaches the records, and it
 * reaches them through the repository, so it carries an audit entry and an
 * inventory transaction like any other change.
 */

interface CountRow {
  partId: string;
  partNumber: string;
  name: string;
  bin: string;
  /** What the records say, refreshed after a count is recorded. */
  expected: number;
  counted: string;
  outcome: "pending" | "confirmed" | "adjusted";
}

export function VerifyPanel({ role }: { role: Role }) {
  const t = useTranslations("verify");
  const tScan = useTranslations("scan");
  const locale = resolveLocale(useLocale());
  const { status, repositories } = useRepositories();
  const actor = useActor(role);
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");
  const [rows, setRows] = useState<CountRow[]>([]);
  const allowed = can(role, "inventory.adjust");

  const onScan = useCallback(
    (result: ScanResult) => {
      if (result.outcome === "unknown") {
        toast.error(tScan("unknownToast", { code: result.scanned }));
        return;
      }
      if (result.outcome === "asset") {
        toast.info(t("assetsDoNotCount"));
        return;
      }
      const part = result.part;
      const bin = repositories?.facilities.binById(part.inventoryLocationId);
      setRows((current) => {
        if (current.some((row) => row.partId === part.id)) {
          return current;
        }
        return [
          ...current,
          {
            partId: part.id,
            partNumber: part.partNumber,
            name: textFor(part.name, locale),
            bin: bin?.code ?? "",
            expected: part.quantityOnHand,
            counted: String(part.quantityOnHand),
            outcome: "pending",
          },
        ];
      });
    },
    [repositories, locale, t, tScan],
  );

  const record = useCallback(
    async (row: CountRow) => {
      if (!repositories) {
        return;
      }
      const counted = Number(row.counted);
      if (!Number.isInteger(counted) || counted < 0) {
        toast.error(t("countInvalid"));
        return;
      }
      try {
        // No note: a sentence written here would be stored on the record, and
        // an English sentence saved in September is still English in the
        // French demonstration in October. `kind: "adjustment"` already says
        // where the movement came from.
        const result = await save(() =>
          repositories.parts.adjust(row.partId, counted, actor),
        );
        // The row keeps its counted figure when the change did not reach the
        // device, so the person can record it again rather than re-count a
        // shelf they have already walked away from.
        if (!result.stored) return;
        const changed = counted !== row.expected;
        setRows((current) =>
          current.map((candidate) =>
            candidate.partId === row.partId
              ? {
                  ...candidate,
                  expected: result.value.quantityOnHand,
                  outcome: changed ? "adjusted" : "confirmed",
                }
              : candidate,
          ),
        );
        toast.success(
          changed
            ? t("adjusted", { partNumber: row.partNumber })
            : t("confirmed", { partNumber: row.partNumber }),
        );
      } catch {
        toast.error(t("countRefused"));
      }
    },
    [repositories, actor, t, save],
  );

  if (!hasRecords(status)) {
    return <LoadingState rows={3} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {allowed ? null : (
        <Alert>
          <AlertTitle>{t("readOnlyTitle")}</AlertTitle>
          <AlertDescription>{t("readOnlyBody")}</AlertDescription>
        </Alert>
      )}

      <ScanPanel onResult={onScan} />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("sheetTitle")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("sheetEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li
                key={row.partId}
                className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold">
                    {row.partNumber}
                  </span>
                  <span className="text-sm">{row.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("binLine", { code: row.bin })}
                  </span>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-sm text-muted-foreground">
                    {t("expected", { quantity: row.expected })}
                  </span>
                  <label className="flex flex-col gap-1 text-sm">
                    {t("countedLabel")}
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="w-28"
                      value={row.counted}
                      disabled={!allowed}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((candidate) =>
                            candidate.partId === row.partId
                              ? { ...candidate, counted: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                  </label>
                  <Button
                    size="sm"
                    disabled={!allowed || saving}
                    aria-busy={saving}
                    onClick={() => void record(row)}
                  >
                    <Check data-icon="inline-start" />
                    {saving ? tSaving("label") : t("record")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setRows((current) =>
                        current.filter(
                          (candidate) => candidate.partId !== row.partId,
                        ),
                      )
                    }
                  >
                    <X data-icon="inline-start" />
                    {t("remove")}
                  </Button>
                </div>

                {row.outcome === "pending" ? null : (
                  <span className="text-sm text-muted-foreground">
                    {t(
                      row.outcome === "adjusted"
                        ? "rowAdjusted"
                        : "rowConfirmed",
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
