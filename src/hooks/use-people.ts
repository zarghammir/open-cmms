"use client";

import { useMemo } from "react";
import {
  peopleByRole,
  peopleList,
  type PersonRow,
  type RoleGroup,
} from "@/data/selectors/people";
import { useDemoData } from "@/hooks/use-demo-data";
import type { Facility } from "@/domain/types";
import type { DemoStatus } from "@/stores/demo-store";

/**
 * The people in the organisation, with the site each works out of.
 *
 * Three states like every other reader of the store: `unknown` is the moment
 * before the browser has read its records back, and a people list drawn as
 * empty then would tell a reviewer this organisation employs nobody.
 */
export function usePeople(): {
  status: DemoStatus;
  people: PersonRow[];
  groups: RoleGroup[];
  /** Every site, for the form that moves somebody between them. */
  facilities: Facility[];
} {
  const { status, data } = useDemoData();

  const people = useMemo(() => (data ? peopleList(data) : []), [data]);
  const groups = useMemo(() => (data ? peopleByRole(data) : []), [data]);

  return { status, people, groups, facilities: data?.facilities ?? [] };
}
