"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FacilityFilter } from "@/components/dashboard/facility-filter";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  REPORTS,
  type ReportCell,
  type ReportKey,
} from "@/data/selectors/reports";
import type { Role } from "@/domain/constants/roles";
import type { Id } from "@/domain/types";
import {
  hasRecords,
  useActor,
  useDemoData,
  useRepositories,
} from "@/hooks/use-demo-data";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useRouter } from "@/i18n/navigation";
import { csvBlob, toCsv } from "@/lib/csv";

/**
 * Four reports, one filter, and a file that is exactly what is on the screen.
 *
 * **The site filter is the dashboard's own control**, imported rather than
 * rebuilt. A second filter that looked the same and narrowed differently is how
 * a reader ends up trusting two numbers that disagree, and the repository's
 * rule is one definition read from both places.
 *
 * **Which report and which site both live in the address.** A report somebody
 * can send to a colleague is worth more than a report they have to describe
 * how to reach, and it costs nothing: the dashboard already carries `facility`
 * in the URL, so this adds `report` beside it.
 */

const KEYS: readonly ReportKey[] = [
  "aging",
  "completion",
  "inventory",
  "inspections",
];

export function ReportsScreen({
  role,
  report,
  facilityId,
}: {
  role: Role;
  report: ReportKey;
  facilityId?: Id;
}) {
  const t = useTranslations("reports");
  const tCategory = useTranslations("partCategory");
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();
  const actor = useActor(role);
  const router = useRouter();
  const breakpoint = useBreakpoint();

  const table = useMemo(
    () =>
      data
        ? REPORTS[report](
            data,
            new Date().toISOString().slice(0, 10),
            facilityId,
          )
        : null,
    [data, report, facilityId],
  );

  /**
   * How one cell reads, in the reader's language.
   *
   * **One formatter, used by the table and by the file.** The export's promise
   * is that the file holds the rows on the screen; two formatters would keep
   * that promise until the day one of them changed. So the CSV is built from
   * this function's output, not from the raw rows.
   */
  const cellText = useMemo(
    () => (column: string, value: ReportCell | undefined) => {
      if (value === undefined) return "";
      if (column === "bucket")
        return t(`bucket.${String(value)}` as "bucket.week");
      if (column === "state") return t(`state.${String(value)}` as "state.low");
      if (column === "category") return tCategory(String(value) as "filters");
      if (column === "rate") return t("percent", { value: Number(value) });
      return String(value);
    },
    [t, tCategory],
  );

  function setParam(next: { report?: ReportKey; facility?: Id }) {
    const params = new URLSearchParams();
    params.set("report", next.report ?? report);
    const site = "facility" in next ? next.facility : facilityId;
    if (site) params.set("facility", site);
    router.push(`/reports?${params.toString()}`);
  }

  function exportRows() {
    if (!table || !repositories) return;

    const headers = table.columns.map((column) =>
      t(`columns.${column}` as "columns.site"),
    );
    const rows = table.rows.map((row) =>
      Object.fromEntries(
        table.columns.map((column, index) => [
          headers[index]!,
          cellText(column, row[column]),
        ]),
      ),
    );

    const url = URL.createObjectURL(csvBlob(toCsv(headers, rows)));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workaxis-${report}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // The trail records it. A demonstration that lets somebody walk away with
    // a file and remembers nothing is telling an evaluator something untrue
    // about what the system keeps.
    repositories.reports.recordExport(report, table.rows.length, actor);
    toast.success(t("exported", { rows: table.rows.length }));
  }

  if (!hasRecords(status) || !table) {
    return <DataTableSkeleton columns={4} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/*
         * `flex-wrap`, and it is the whole of WA-102.
         *
         * The group ships `flex w-fit flex-row` with no wrapping, so four
         * report names sit on one line whatever the viewport: 538 px of
         * control inside 390 px of phone, and `/reports` scrolled sideways by
         * 164 px in English and 318 in French.
         *
         * Wrapping rather than scrolling, because all four names stay visible.
         * A horizontal scroller would put "Taux de réussite des inspections"
         * off the edge with no affordance saying it is there, and a reader who
         * cannot see an option cannot choose it — the same argument as a gated
         * control staying visible rather than disappearing.
         *
         * Unconditional rather than `md:`-scoped on purpose. `w-fit` is
         * `fit-content`, which caps at the space available, so this changes
         * nothing at any width where the row already fits — and a fix scoped
         * to one breakpoint leaves every width between breakpoints uncovered.
         * The French labels are 30 and 32 characters; each one alone fits a
         * phone, four abreast never will.
         */}
        <ToggleGroup
          className="flex-wrap"
          type="single"
          value={report}
          aria-label={t("choose")}
          onValueChange={(next) => {
            // An empty value means the reader pressed the report already
            // chosen. That is not a request to have no report.
            if (next) setParam({ report: next as ReportKey });
          }}
        >
          {KEYS.map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {t(`name.${key}` as "name.aging")}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <FacilityFilter
          facilities={data?.facilities ?? null}
          value={facilityId}
          onChange={(next) => setParam({ facility: next })}
        />

        <Button
          size="sm"
          variant="outline"
          onClick={exportRows}
          disabled={table.rows.length === 0}
        >
          <Download data-icon="inline-start" />
          {t("export")}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {t(`about.${report}` as "about.aging")}
      </p>

      {table.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle className="text-base">{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/*
            At 390 a report is not a table, which is the repository's own rule
            for every register and is right for the same reason here: seven
            columns on a phone is a horizontal scroll, and a scrollable box is
            a box a keyboard cannot reach unless somebody remembers to make it
            focusable. Cards remove the scroll rather than making it reachable.

            Found by an axe scan at 390 in French and not in English: the French
            column headers are wider, so the same markup overflowed in one
            language and fitted in the other.
          */}
          {breakpoint === "phone" ? (
            <ul className="flex flex-col gap-2">
              {table.rows.map((row, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
                >
                  {table.columns.map((column) => (
                    <p
                      key={column}
                      className="flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {t(`columns.${column}` as "columns.site")}
                      </span>
                      <span>{cellText(column, row[column])}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                {t(`name.${report}` as "name.aging")}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {table.columns.map((column) => (
                    <TableHead key={column}>
                      {t(`columns.${column}` as "columns.site")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, index) => (
                  <TableRow key={index}>
                    {table.columns.map((column) => (
                      <TableCell key={column}>
                        {cellText(column, row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t("rowsShown", { rows: table.rows.length })}
      </p>
    </div>
  );
}
