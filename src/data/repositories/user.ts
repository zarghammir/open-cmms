import type { Role } from "@/domain/constants/roles";
import { fullName } from "@/domain/types/user";
import { fieldChanges, type Actor } from "@/stores/mutations";
import { assignmentForCrewCode, type CrewAssignment } from "@/data/seed/people";
import type { Id, User } from "@/domain/types";
import type { RepositoryContext } from "./types";

export interface UserRepository {
  list: () => User[];
  byId: (id: Id) => User | undefined;
  byRole: (role: Role) => User[];
  /**
   * Who a legacy crew code belongs to.
   *
   * `undefined` means the code is unknown, which is not the same as nobody
   * being assigned. A caller that flattens the two loses what the source
   * system recorded.
   */
  byCrewCode: (code: string) => CrewAssignment | undefined;

  /**
   * Moves a person to another role.
   *
   * **What this changes and what it does not.** It changes the record, the
   * trail, and what work the person may be given — `assignable.ts` asks a
   * person's role, so a technician made an auditor stops being offered work
   * the moment this is written. It does **not** change what the person
   * currently looking at the screen can do: Phase 1 has no sign-in and a
   * viewer's capabilities come from the role switcher. That seam is stated on
   * the pull request rather than left for somebody to find by clicking.
   */
  changeRole: (id: Id, role: Role, actor: Actor) => User;

  /** Moves a person to another site. The lists that filter by site follow. */
  changeSite: (id: Id, facilityId: Id, actor: Actor) => User;

  /**
   * Takes a person out of circulation, or puts them back.
   *
   * `active` already existed and was already honoured — `assignable.ts:37`
   * filters on it, with a comment saying somebody who has left is not a person
   * to give work to. Nothing about the stored shape changes here; what was
   * missing was any way for an administrator to set it.
   */
  setActive: (id: Id, active: boolean, actor: Actor) => User;
}

export function createUserRepository(
  context: RepositoryContext,
): UserRepository {
  return {
    list: () => context.data.users,
    byId: (id) => context.data.users.find((user) => user.id === id),
    byRole: (role) => context.data.users.filter((user) => user.role === role),
    byCrewCode: (code) => assignmentForCrewCode(code),

    changeRole: (id, role, actor) =>
      write(id, { role }, actor, (user, next) => ({
        summaryKey: "audit.userRoleChanged",
        summaryParams: {
          user: fullName(user),
          fromRole: user.role,
          toRole: next.role as Role,
        },
      })),

    changeSite: (id, facilityId, actor) =>
      write(id, { homeFacilityId: facilityId }, actor, (user, next) => {
        const site = (id: Id) =>
          context.data.facilities.find((one) => one.id === id);
        return {
          summaryKey: "audit.userSiteChanged",
          summaryParams: {
            user: fullName(user),
            /*
             * The site code, not its name. A code is one word in both
             * languages and is what people say out loud, and a name that no
             * longer resolves would put a raw identifier in the middle of a
             * sentence — so an unreadable site says so instead.
             */
            fromSite: site(user.homeFacilityId)?.code ?? "unknown",
            toSite: site(next.homeFacilityId as Id)?.code ?? "unknown",
          },
        };
      }),

    setActive: (id, active, actor) =>
      write(id, { active }, actor, (user) => ({
        summaryKey: active ? "audit.userReactivated" : "audit.userDeactivated",
        summaryParams: { user: fullName(user) },
      })),
  };

  /**
   * One write, one entry, and nothing at all when nothing changed.
   *
   * Shared by the three methods above so the audit entry cannot be forgotten
   * by the fourth one somebody adds. The no-op guard sits here rather than
   * only in a hook: a screen can be careful, and the repository is the thing
   * that cannot be talked out of it — an entry saying a person was changed,
   * listing no change, is a record of something that did not happen.
   */
  function write(
    id: Id,
    changes: Partial<User>,
    actor: Actor,
    describe: (
      user: User,
      next: Partial<User>,
    ) => { summaryKey: string; summaryParams: Record<string, string | number> },
  ): User {
    const user = context.data.users.find((one) => one.id === id);
    if (!user) throw new Error(`No user with id ${id}`);

    const difference = fieldChanges(
      user as unknown as Record<string, unknown>,
      changes as Record<string, unknown>,
    );
    if (difference.length === 0) return user;

    const said = describe(user, changes);
    context.commit({
      operation: "update",
      collection: "users",
      id,
      changes: changes as Record<string, unknown>,
      actor,
      audit: {
        entity: "user",
        action: "updated",
        summaryKey: said.summaryKey,
        summaryParams: said.summaryParams,
        changes: difference,
      },
    });

    return { ...user, ...changes };
  }
}
