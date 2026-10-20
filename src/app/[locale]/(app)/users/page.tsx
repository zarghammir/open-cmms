import { PeopleTable } from "@/components/users/people-table";
import { RoleTable } from "@/components/users/role-table";
import { InviteAction } from "@/components/users/invite-action";
import { ModuleScreen } from "@/components/shared/module-screen";
import { getDemoRole } from "@/lib/server-session";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("users", params);
}

export default async function UsersPage() {
  // The role is read on the server, so the first paint already carries the
  // right gate rather than flashing an enabled control and then disabling it.
  const role = await getDemoRole();

  return (
    <ModuleScreen moduleKey="users" actions={<InviteAction />}>
      <PeopleTable role={role} />
      <RoleTable />
    </ModuleScreen>
  );
}
