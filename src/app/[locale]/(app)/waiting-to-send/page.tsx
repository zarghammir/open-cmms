import { PendingQueue } from "@/components/offline/pending-queue";
import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

/**
 * What this device has not sent, for whoever is holding it.
 *
 * Registered as a module so `ModuleScreen` is still the one role check, and
 * marked hidden so it stays out of both navigation rails: it is reached from
 * the offline banner, where the count that raises the question is, rather than
 * from a twelfth name in a list.
 */
export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("waitingToSend", params);
}

export default async function WaitingToSendPage() {
  const role = await getDemoRole();

  return (
    <ModuleScreen moduleKey="waitingToSend">
      <PendingQueue role={role} />
    </ModuleScreen>
  );
}
