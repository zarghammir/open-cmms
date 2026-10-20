import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ModuleScreen } from "@/components/shared/module-screen";
import { LoadingState } from "@/components/shared/state-panels";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("dashboard", params);
}

/**
 * Home for the desk roles.
 *
 * The screen itself is a client component: every number on it is counted from
 * records the browser holds, so none of it can be rendered on the server. The
 * boundary here is what lets the header and the page title be prerendered
 * anyway, and its fallback is the same skeleton the panels show while the
 * database is being read — so the wait looks like one thing, not two.
 */
export default function DashboardPage() {
  return (
    <ModuleScreen moduleKey="dashboard" showToday>
      <Suspense fallback={<LoadingState rows={6} />}>
        <DashboardView />
      </Suspense>
    </ModuleScreen>
  );
}
