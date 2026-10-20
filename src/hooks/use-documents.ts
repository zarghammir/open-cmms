"use client";

import { useCallback, useMemo } from "react";
import { useLocale } from "next-intl";
import { documentRows, type DocumentRow } from "@/data/selectors/documents";
import type { UploadRequest } from "@/data/repositories/document";
import { UnsupportedFileTypeError } from "@/data/repositories/document";
import type { DocumentRecord } from "@/domain/types";
import { useDemoData, useRepositories } from "@/hooks/use-demo-data";
import type { Actor } from "@/stores/mutations";

/**
 * Documents, for the screens that draw them.
 *
 * Three states like every other hook here: `unknown` is the moment before the
 * browser has read its records back, and a library that drew "no documents"
 * then would be telling a reviewer something untrue about an organisation that
 * has forty.
 */
export function useDocumentLibrary(): {
  status: ReturnType<typeof useDemoData>["status"];
  rows: DocumentRow[];
} {
  const { status, data } = useDemoData();
  const locale = useLocale();

  const rows = useMemo(
    () => (data ? documentRows(data, locale) : []),
    [data, locale],
  );

  return { status, rows };
}

/** The paperwork on one work order, newest first. */
export function useWorkOrderDocuments(workOrderId: string): {
  status: ReturnType<typeof useDemoData>["status"];
  documents: DocumentRecord[];
} {
  const { status } = useDemoData();
  const { repositories } = useRepositories();

  const documents = useMemo(
    () => repositories?.documents.forWorkOrder(workOrderId) ?? [],
    [repositories, workOrderId],
  );

  return { status, documents };
}

/**
 * Recording a file somebody chose.
 *
 * Returns the written record, or `null` when there is nothing to write to yet.
 * A refused type comes back as `UnsupportedFileTypeError` for the caller to
 * turn into a sentence in the reader's language — the repository refuses by
 * name, and the screen is what says so out loud.
 */
export function useDocumentUpload(): (
  request: UploadRequest,
  actor: Actor,
) => DocumentRecord | null {
  const { repositories } = useRepositories();

  return useCallback(
    (request, actor) => repositories?.documents.upload(request, actor) ?? null,
    [repositories],
  );
}

export { UnsupportedFileTypeError };
export type { DocumentRow, UploadRequest };
