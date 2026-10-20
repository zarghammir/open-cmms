import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("inspections", params);
}

export default function InspectionsPage() {
  return <ModuleScreen moduleKey="inspections" />;
}
