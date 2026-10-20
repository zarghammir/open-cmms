"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TARGET_FIELDS,
  unmappedFields,
  unmappedRequired,
  type ColumnMapping,
  type SheetKind,
} from "@/lib/import/mapping";
import type { SheetData } from "@/lib/import/validate";

/**
 * Matching a spreadsheet's columns to WorkAxis fields.
 *
 * A select rather than a combobox, and a native one: the project adds no
 * registry components for this, and on a phone a native select gives the
 * platform picker a person already knows.
 *
 * "Do not import" is a real choice rather than the absence of one. A column
 * left unmatched because nobody looked and a column deliberately excluded are
 * different decisions, and only the second should be silent.
 */

const IGNORE = "";

export function MappingStep({
  sheets,
  mappings,
  onChange,
}: {
  sheets: readonly SheetData[];
  mappings: Record<SheetKind, ColumnMapping>;
  onChange: (
    kind: SheetKind,
    field: string,
    column: string | undefined,
  ) => void;
}) {
  const t = useTranslations("import.map");
  const tSheets = useTranslations("import.preview");

  const stillNeeded = sheets.reduce(
    (total, sheet) =>
      total + unmappedFields(sheet.kind, mappings[sheet.kind]).length,
    0,
  );
  const blocked = sheets.flatMap((sheet) =>
    unmappedRequired(sheet.kind, mappings[sheet.kind]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        <p className="text-sm">
          {stillNeeded === 0
            ? t("allMatched")
            : t("stillNeeded", { count: stillNeeded })}
        </p>
      </div>

      {blocked.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{t("blockedTitle")}</AlertTitle>
          <AlertDescription>{t("blockedBody")}</AlertDescription>
        </Alert>
      ) : null}

      {sheets.map((sheet) => {
        const mapping = mappings[sheet.kind];
        const label =
          sheet.kind === "equipment"
            ? tSheets("assets")
            : sheet.kind === "inventory"
              ? tSheets("parts")
              : tSheets("workOrders");

        return (
          <section key={sheet.kind} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{label}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption className="sr-only">{label}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("field")}</TableHead>
                    <TableHead>{t("column")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TARGET_FIELDS[sheet.kind].map((field) => {
                    const chosen = mapping[field.key] ?? IGNORE;
                    const selectId = `${sheet.kind}-${field.key}`;
                    return (
                      <TableRow key={field.key}>
                        <TableCell>
                          <label
                            htmlFor={selectId}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="font-mono text-sm">
                              {field.key}
                            </span>
                            {field.required ? (
                              <Badge variant="secondary">{t("required")}</Badge>
                            ) : null}
                            {chosen === IGNORE ? (
                              <Badge
                                variant={
                                  field.required ? "destructive" : "outline"
                                }
                              >
                                {t("unmapped")}
                              </Badge>
                            ) : null}
                          </label>
                        </TableCell>
                        <TableCell>
                          <select
                            id={selectId}
                            className="h-9 w-full max-w-64 rounded-md border border-input bg-transparent px-3 text-sm"
                            value={chosen}
                            aria-invalid={
                              field.required && chosen === IGNORE
                                ? true
                                : undefined
                            }
                            onChange={(event) =>
                              onChange(
                                sheet.kind,
                                field.key,
                                event.target.value === IGNORE
                                  ? undefined
                                  : event.target.value,
                              )
                            }
                          >
                            <option value={IGNORE}>{t("ignore")}</option>
                            {sheet.headers.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
