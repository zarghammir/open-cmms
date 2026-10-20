import { ReportsScreen } from "@/components/reports/reports-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { REPORTS, type ReportKey } from "@/data/selectors/reports";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("reports", params);
}

/**
 * The reports. Which one and which site come from the address, so a report can
 * be sent to somebody rather than described to them.
 *
 * A name the system does not hold falls back to the first report rather than
 * rendering nothing: a bad link is a bad link, not an empty screen that reads
 * like a broken module.
 */
export default async function ReportsPage({
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ report?: string; facility?: string }>;
}) {
  const { report, facility } = await searchParams;
  const role = await getDemoRole();
  const chosen: ReportKey =
    report && report in REPORTS ? (report as ReportKey) : "aging";

  return (
    <ModuleScreen moduleKey="reports">
      <ReportsScreen role={role} report={chosen} facilityId={facility} />
    </ModuleScreen>
  );
}
