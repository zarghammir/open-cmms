"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { DocumentRecord } from "@/domain/types";
import { textFor } from "@/lib/localized-text";

/**
 * A list of documents, wherever they are filed.
 *
 * Lifted out of `assets/asset-documents.tsx` (WA-10) so the work-order panel
 * draws paperwork exactly as the asset tab does, rather than a second list that
 * agrees with it today. Two copies of a list is two places to change when the
 * size or the version stops being shown — and one of them gets missed.
 *
 * Metadata only, and the panels around it say so: Phase 1 holds no bytes.
 */
export function DocumentList({
  documents,
}: {
  documents: readonly DocumentRecord[];
}) {
  const t = useTranslations("assetDetail.documents");
  const tKind = useTranslations("documentKind");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <ul className="flex flex-col">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0"
        >
          <span className="text-sm font-medium">
            {textFor(document.title, locale)}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{tKind(document.kind)}</span>
            <span aria-hidden="true">{"·"}</span>
            <span className="font-mono">{document.fileName}</span>
            <span aria-hidden="true">{"·"}</span>
            <span>
              {t("size", {
                kilobytes: Math.round(document.sizeBytes / 1024),
              })}
            </span>
            <span aria-hidden="true">{"·"}</span>
            <span>{t("version", { version: document.version })}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {t("uploadedOn", {
              date: format.dateTime(new Date(document.uploadedAt), "day"),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
