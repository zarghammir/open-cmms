"use client";

import { Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSearch } from "lucide-react";
import type { ImportRun } from "@/lib/import/run";
import type { ImportIssue } from "@/lib/import/validate";

/**
 * What is wrong with the spreadsheet, row by row.
 *
 * Three states rather than two: the rows have not been read yet, they were read
 * and nothing was wrong, or here is what was found. "Nothing to report" and
 * "not checked" look nothing alike, because telling somebody their data is
 * clean when it has not been looked at is the worst of the three.
 *
 * Every issue names a sheet, a row and a column — the same coordinates the
 * fixture's data dictionary uses, so a reviewer can hold the two side by side.
 */

export function ReportStep({
  run,
  onFix,
}: {
  run: ImportRun | null;
  onFix: (issue: ImportIssue, value: string) => void;
}) {
  const t = useTranslations("import.report");
  const tIssue = useTranslations("import.issue");
  const tSheets = useTranslations("import.preview");

  /** The tab's name in the reader's language, not the key we match tabs by. */
  const sheetLabel = (kind: ImportIssue["sheet"]) =>
    kind === "equipment"
      ? tSheets("assets")
      : kind === "inventory"
        ? tSheets("parts")
        : tSheets("workOrders");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (run === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch />
          </EmptyMedia>
          <EmptyTitle className="text-base">{t("notRunTitle")}</EmptyTitle>
          <EmptyDescription>{t("notRunBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (run.issues.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch />
          </EmptyMedia>
          <EmptyTitle className="text-base">{t("cleanTitle")}</EmptyTitle>
          <EmptyDescription>{t("cleanBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const blocking = run.issues.filter((issue) => issue.severity === "blocking");
  const recoverable = run.issues.length - blocking.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">
          {t("blocking", { count: blocking.length })}
        </Badge>
        <Badge variant="secondary">
          {t("recoverable", { count: recoverable })}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t("rowsAffected", { rows: run.counts.rowsWithIssues })}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableCaption className="sr-only">{t("title")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sheet")}</TableHead>
              <TableHead>{t("row")}</TableHead>
              <TableHead>{t("column")}</TableHead>
              <TableHead>{t("problem")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.issues.map((issue) => {
              const key = `${issue.sheet}:${issue.row}:${issue.column}:${issue.code}`;
              const open = editing === key;
              return (
                <TableRow key={key}>
                  <TableCell className="text-sm">
                    {sheetLabel(issue.sheet)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {issue.row}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {issue.column}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">
                        {tIssue(issue.code, issue.params)}
                      </span>
                      <Badge
                        variant={
                          issue.severity === "blocking"
                            ? "destructive"
                            : "outline"
                        }
                        className="w-fit"
                      >
                        {issue.severity === "blocking"
                          ? t("blockingBadge")
                          : t("recoverableBadge")}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {open ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="w-40"
                          value={draft}
                          aria-label={t("fixLabel", {
                            column: issue.column,
                            row: issue.row,
                          })}
                          onChange={(event) => setDraft(event.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            onFix(issue, draft);
                            setEditing(null);
                            setDraft("");
                          }}
                        >
                          {t("fixSave")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(null);
                            setDraft("");
                          }}
                        >
                          {t("fixCancel")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(key);
                          setDraft("");
                        }}
                      >
                        <Wrench data-icon="inline-start" />
                        {t("fixAction")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
