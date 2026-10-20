"use client";

import { Check, Undo2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/state-panels";
import { MappingStep } from "@/components/import/mapping-step";
import { PreviewStep } from "@/components/import/preview-step";
import { ReportStep } from "@/components/import/report-step";
import { can, type Role } from "@/domain/constants/roles";
import { useActor } from "@/hooks/use-demo-data";
import { useImport } from "@/hooks/use-import";
import {
  suggestMapping,
  unmappedRequired,
  type ColumnMapping,
  type SheetKind,
} from "@/lib/import/mapping";
import type { ImportRun } from "@/lib/import/run";
import {
  IMPORT_STEPS,
  canReach,
  nextStep,
  previousStep,
  stepIndex,
  type ImportStep,
  type StepReadiness,
} from "@/lib/import/steps";
import { readImportSheets } from "@/lib/import/read-workbook";
import type { ImportIssue, SheetData } from "@/lib/import/validate";
import { importedCount, type ImportBatch } from "@/domain/types";

/**
 * The MP2 import, in five steps.
 *
 * One run of the importer produces both the report and the records, and the
 * wizard holds that one object: the number on the report is the number that
 * gets written, because there is no second pass to disagree with the first.
 *
 * Changing a mapping clears the run rather than leaving it behind, so a report
 * built from columns that no longer apply cannot be reopened with a back
 * button. `canReach` asks the state, never how far somebody has clicked.
 */

type FileState =
  | { kind: "none" }
  | { kind: "reading" }
  | { kind: "unreadable" }
  | { kind: "noSheets"; name: string }
  | { kind: "read"; name: string; sheets: SheetData[] };

const EMPTY_MAPPINGS: Record<SheetKind, ColumnMapping> = {
  equipment: {},
  inventory: {},
  workOrders: {},
};

export function ImportWizard({ role }: { role: Role }) {
  const t = useTranslations("import");
  const actor = useActor(role);
  const tools = useImport(actor);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<FileState>({ kind: "none" });
  const [mappings, setMappings] =
    useState<Record<SheetKind, ColumnMapping>>(EMPTY_MAPPINGS);
  const [run, setRun] = useState<ImportRun | null>(null);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Kept as a guard and deliberately not explained on screen: every role that
   * can open Settings also holds `settings.manage`, so a panel saying "you may
   * not commit" could never render. Unreachable copy is the thing this project
   * treats as a defect — the two strings that survived WA-25's sweep were the
   * two nothing rendered. If Settings is ever opened to a role without the
   * capability, the button is already disabled and the explanation belongs
   * here then, not before.
   */
  const allowed = can(role, "settings.manage");

  const sheets = useMemo(
    () => (file.kind === "read" ? file.sheets : []),
    [file],
  );

  const mappingComplete = useMemo(
    () =>
      sheets.length > 0 &&
      sheets.every(
        (sheet) =>
          unmappedRequired(sheet.kind, mappings[sheet.kind]).length === 0,
      ),
    [sheets, mappings],
  );

  /**
   * The import that can still be undone.
   *
   * Falls back to the store, because the batch is durable and the component's
   * memory is not: importing, going to look at the assets it created and coming
   * back used to leave no way to undo, even though the batch was sitting there
   * the whole time. "Undo this import" has to mean the last one that stands,
   * not the last one this component happened to watch.
   */
  const committed = batch ?? tools.latestUndoable() ?? null;

  const readiness: StepReadiness = {
    hasSheets: sheets.length > 0,
    mappingComplete,
    hasRun: run !== null,
    committed: committed !== null,
  };

  const chooseFile = useCallback(async (chosen: File) => {
    setFile({ kind: "reading" });
    // A new file invalidates everything downstream of it.
    setMappings(EMPTY_MAPPINGS);
    setRun(null);
    setBatch(null);

    let read: SheetData[];
    try {
      read = await readImportSheets(chosen);
    } catch {
      setFile({ kind: "unreadable" });
      return;
    }

    if (read.length === 0) {
      setFile({ kind: "noSheets", name: chosen.name });
      return;
    }

    const suggested = { ...EMPTY_MAPPINGS };
    for (const sheet of read) {
      suggested[sheet.kind] = suggestMapping(sheet.kind, sheet.headers);
    }
    setMappings(suggested);
    setFile({ kind: "read", name: chosen.name, sheets: read });
    setStep("map");
  }, []);

  const changeMapping = useCallback(
    (kind: SheetKind, field: string, column: string | undefined) => {
      setMappings((current) => ({
        ...current,
        [kind]: { ...current[kind], [field]: column },
      }));
      // The report was built from the old columns. Keeping it would let a back
      // button reopen a preview that no longer describes this import.
      setRun(null);
    },
    [],
  );

  /**
   * Reads the rows and builds the report. One run: the count it produces is the
   * count the commit writes, because the same object carries both.
   */
  const readRows = useCallback(() => {
    const result = tools.run(sheets, mappings);
    setRun(result);
    return result;
  }, [tools, sheets, mappings]);

  /**
   * Correcting one cell and reading the rows again.
   *
   * The spreadsheet on disk is not touched — the correction lives in the copy
   * being imported, which is the honest shape: this is a decision about what to
   * import, not an edit to somebody's export.
   */
  const applyFix = useCallback((issue: ImportIssue, value: string) => {
    setFile((current) => {
      if (current.kind !== "read") return current;
      return {
        ...current,
        sheets: current.sheets.map((sheet) => {
          if (sheet.kind !== issue.sheet) return sheet;
          const column = sheet.headers.indexOf(issue.column);
          if (column === -1) return sheet;
          return {
            ...sheet,
            rows: sheet.rows.map((row, index) =>
              index + 2 === issue.row
                ? row.map((cell, at) => (at === column ? value : cell))
                : row,
            ),
          };
        }),
      };
    });
    // The report described the rows as they were. Clear it rather than leave
    // a stale line pointing at a cell that has changed.
    setRun(null);
  }, []);

  /**
   * Writing the import. One call, because `commitImport` is already one act:
   * every record, the batch that records them, one audit entry and one outbox
   * entry, all or nothing.
   */
  const commitNow = useCallback(() => {
    if (!run || file.kind !== "read") return;
    try {
      setFailed(false);
      setBatch(tools.commit(run, file.name));
    } catch {
      // The store refused, so nothing was written. Say that, rather than
      // leaving a button that looks like it did something.
      setFailed(true);
    }
  }, [run, file, tools]);

  const undoNow = useCallback(() => {
    const undoable = batch ?? tools.latestUndoable();
    if (!undoable) return;
    tools.rollback(undoable.id);
    setBatch(null);
    setRun(null);
  }, [batch, tools]);

  if (!tools.ready) {
    return <LoadingState rows={4} />;
  }

  const forward = nextStep(step, readiness);
  const back = previousStep(step);
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {committed !== null && step !== "commit" ? (
        /*
         * A standing import can be undone from anywhere in the wizard, not
         * only from the step that created it. Coming back to look at what an
         * import did is the normal thing to do, and a fresh visit starts at
         * step one with no file — so burying undo in step five meant the only
         * way to reach it was to import the same spreadsheet again.
         */
        <Alert>
          <AlertTitle>{t("commit.doneTitle")}</AlertTitle>
          <AlertDescription>
            {t("commit.doneBody", {
              count: importedCount(committed),
              fileName: committed.fileName,
            })}
          </AlertDescription>
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={undoNow}>
              <Undo2 data-icon="inline-start" />
              {t("commit.undo")}
            </Button>
          </div>
        </Alert>
      ) : null}

      <ol className="flex flex-wrap gap-2" aria-label={t("title")}>
        {IMPORT_STEPS.map((candidate, index) => {
          const reachable = canReach(candidate, readiness);
          const current = candidate === step;
          const done = stepIndex(candidate) < stepIndex(step);
          return (
            <li key={candidate}>
              <Button
                size="sm"
                variant={current ? "default" : "outline"}
                disabled={!reachable}
                aria-current={current ? "step" : undefined}
                onClick={() => setStep(candidate)}
              >
                {done ? <Check data-icon="inline-start" /> : null}
                <span className="font-mono text-2xs">{index + 1}</span>
                {t(`steps.${candidate}`)}
              </Button>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted-foreground">
        {t("stepOf", {
          current: stepIndex(step) + 1,
          total: IMPORT_STEPS.length,
        })}
      </p>

      {step === "upload" ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t("upload.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("upload.body")}</p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) void chooseFile(chosen);
              event.target.value = "";
            }}
          />
          <div>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload data-icon="inline-start" />
              {t("upload.action")}
            </Button>
          </div>

          {file.kind === "reading" ? (
            <p className="text-sm text-muted-foreground">
              {t("upload.reading")}
            </p>
          ) : null}

          {file.kind === "unreadable" ? (
            <Alert variant="destructive">
              <AlertTitle>{t("upload.unreadableTitle")}</AlertTitle>
              <AlertDescription>{t("upload.unreadableBody")}</AlertDescription>
            </Alert>
          ) : null}

          {file.kind === "noSheets" ? (
            <Alert variant="destructive">
              <AlertTitle>{t("upload.noSheetsTitle")}</AlertTitle>
              <AlertDescription>{t("upload.noSheetsBody")}</AlertDescription>
            </Alert>
          ) : null}

          {file.kind === "read" ? (
            <p className="text-sm">
              {t("upload.found", { sheets: sheets.length, rows: totalRows })}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "map" ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t("map.title")}</h2>
          <MappingStep
            sheets={sheets}
            mappings={mappings}
            onChange={changeMapping}
          />
        </section>
      ) : null}

      {step === "report" ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t("report.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("report.body")}</p>
          <ReportStep run={run} onFix={applyFix} />
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t("preview.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("preview.body")}</p>
          <PreviewStep run={run} />
        </section>
      ) : null}

      {step === "commit" ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t("commit.title")}</h2>

          {committed === null ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("commit.body", { count: run?.counts.total ?? 0 })}
              </p>
              {failed ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("commit.failedTitle")}</AlertTitle>
                  <AlertDescription>{t("commit.failedBody")}</AlertDescription>
                </Alert>
              ) : null}
              <div>
                <Button size="sm" disabled={!allowed} onClick={commitNow}>
                  <Check data-icon="inline-start" />
                  {t("commit.action", { count: run?.counts.total ?? 0 })}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <AlertTitle>{t("commit.doneTitle")}</AlertTitle>
                <AlertDescription>
                  {/* Counted from the batch, not from the run: after the
                      write, what exists is what the batch says it created. */}
                  {t("commit.doneBody", {
                    count: importedCount(committed),
                    fileName: committed.fileName,
                  })}
                </AlertDescription>
              </Alert>
              <div>
                <Button size="sm" variant="outline" onClick={undoNow}>
                  <Undo2 data-icon="inline-start" />
                  {t("commit.undo")}
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {back ? (
          <Button size="sm" variant="outline" onClick={() => setStep(back)}>
            {t("back")}
          </Button>
        ) : null}
        {step === "map" && mappingComplete && run === null ? (
          <Button
            size="sm"
            onClick={() => {
              readRows();
              setStep("report");
            }}
          >
            {t("next")}
          </Button>
        ) : forward ? (
          <Button size="sm" onClick={() => setStep(forward)}>
            {t("next")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
