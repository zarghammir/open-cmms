"use client";

import { useCallback } from "react";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { can, type Role } from "@/domain/constants/roles";
import type { Id } from "@/domain/types";

export interface PersonChanges {
  role: Role;
  homeFacilityId: Id;
  active: boolean;
}

/**
 * Changing a person's record, and whether this role may.
 *
 * Three separate repository calls rather than one update, because the three
 * are three different sentences in the trail — a role change, a move between
 * sites, and somebody leaving or coming back are not one event with a field
 * name attached. Each writes only if it changed something, so submitting a
 * form with everything as it was writes nothing and says nothing.
 *
 * `editable` is asked here rather than at each control, because a control a
 * role may not use stays on screen and disabled: the 2026-09-16 ruling, and
 * the screen has to know the answer rather than have permission to hide.
 */
export function useManagePeople(role: Role): {
  editable: boolean;
  /** How many of the three actually changed. Zero is a legitimate answer. */
  apply: (personId: Id, changes: PersonChanges) => number;
} {
  const { repositories } = useRepositories();
  const actor = useActor(role);

  const apply = useCallback(
    (personId: Id, changes: PersonChanges) => {
      if (!repositories) return 0;
      const before = repositories.users.byId(personId);
      if (!before) return 0;

      let written = 0;
      if (before.role !== changes.role) {
        repositories.users.changeRole(personId, changes.role, actor);
        written += 1;
      }
      if (before.homeFacilityId !== changes.homeFacilityId) {
        repositories.users.changeSite(personId, changes.homeFacilityId, actor);
        written += 1;
      }
      if (before.active !== changes.active) {
        repositories.users.setActive(personId, changes.active, actor);
        written += 1;
      }
      return written;
    },
    [repositories, actor],
  );

  return { editable: can(role, "users.manage"), apply };
}
