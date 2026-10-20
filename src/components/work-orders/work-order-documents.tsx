"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/shared/document-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Role } from "@/domain/constants/roles";
import type { Id } from "@/domain/types";
import { useWorkOrderDocuments } from "@/hooks/use-documents";

/**
 * The paperwork on this work order.
 *
 * The rows are `shared/document-list.tsx`, the same list the asset tab draws —
 * lifted out of WA-10's component rather than written a second time, so the two
 * cannot drift into showing different things about the same record.
 *
 * Two states here and not three, for the reason `AssetPanel` gives: by the time
 * this renders the order itself has resolved, so its documents are known. They
 * can be empty; they cannot be unknown.
 */
export function WorkOrderDocuments({
  workOrderId,
  role,
}: {
  workOrderId: Id;
  role: Role;
}) {
  const t = useTranslations("documentUpload");
  const { documents } = useWorkOrderDocuments(workOrderId);

  return (
    <Card className="lg:mb-4 lg:break-inside-avoid">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {documents.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle className="text-base">{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyBody")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DocumentList documents={documents} />
        )}

        <DocumentUpload role={role} workOrderId={workOrderId} />
      </CardContent>
    </Card>
  );
}
