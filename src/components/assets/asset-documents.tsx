import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import { DocumentList } from "@/components/shared/document-list";
import type { DocumentRecord } from "@/domain/types";

/**
 * The paperwork filed against this asset.
 *
 * Metadata only, and the panel says so: Phase 1 holds no bytes. Offering a
 * download that cannot arrive would be a worse demonstration than stating the
 * boundary, and an evaluator reading the proposal already knows file storage is
 * Phase 2.
 *
 * **The rows moved to `shared/document-list.tsx` in WA-21** so the work-order
 * attachments panel draws them identically rather than growing a second list
 * that agrees with this one only until one of them changes. Nothing about this
 * tab changed; the markup is the same markup.
 */
export function AssetDocuments({ documents }: { documents: DocumentRecord[] }) {
  const t = useTranslations("assetDetail.documents");

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={documents}
      emptyIcon={FileText}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => <DocumentList documents={rows} />}
    </AssetPanel>
  );
}
