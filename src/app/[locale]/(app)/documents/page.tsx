import { DocumentsScreen } from "@/components/documents/documents-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("documents", params);
}

/**
 * The document library. The page stays a server component and the table is a
 * client one, the same division the assets and parts registers use, so the
 * shell, the heading and the module gate are server-rendered as before.
 */
export default function DocumentsPage() {
  return (
    <ModuleScreen moduleKey="documents">
      <DocumentsScreen />
    </ModuleScreen>
  );
}
