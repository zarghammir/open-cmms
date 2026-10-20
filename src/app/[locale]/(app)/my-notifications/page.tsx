import { ModuleScreen } from "@/components/shared/module-screen";
import { MyNotifications } from "@/components/notifications/my-notifications";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

/**
 * A person's own notification choices.
 *
 * Its own route, and every role may open it, because what somebody wants to
 * hear about is theirs. It began on the Settings screen, which two of the six
 * roles can open — so a technician, the person "a job has landed on you" is
 * written for, could not choose what reached them, and an auditor could not see
 * the switches they are meant to see disabled.
 *
 * Hidden from the navigation rail: it is reached from the bell and from the
 * session menu, which is where somebody looks for it, and the rail keeps the
 * eleven modules the specification sets. It is registered in `navigation.ts`
 * anyway, so `ModuleScreen` remains the one place a role check happens.
 *
 * The email log stays on Settings. That one is the organization's record of
 * what would have been sent to everybody, and it belongs to an administrator.
 */
export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("myNotifications", params);
}

export default async function MyNotificationsPage() {
  const role = await getDemoRole();

  return (
    <ModuleScreen moduleKey="myNotifications">
      <MyNotifications role={role} />
    </ModuleScreen>
  );
}
