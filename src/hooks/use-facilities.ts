"use client";

import { useMemo } from "react";
import {
  equipmentIn,
  facilityTree,
  type FacilityNode,
} from "@/data/selectors/facility-tree";
import { useDemoData } from "@/hooks/use-demo-data";
import type { Asset, Id } from "@/domain/types";
import type { DemoStatus } from "@/stores/demo-store";

/**
 * The places, as a tree, with what is at each.
 *
 * Three states like every other reader of the store: `unknown` is the moment
 * before the browser has read its records back, and a tree drawn as empty then
 * would tell a reviewer this organisation looks after nothing.
 */
export function useFacilities(): {
  status: DemoStatus;
  sites: FacilityNode[];
  equipmentIn: (locationId: Id) => Asset[];
} {
  const { status, data } = useDemoData();

  const sites = useMemo(() => (data ? facilityTree(data) : []), [data]);

  return {
    status,
    sites,
    equipmentIn: (locationId) => (data ? equipmentIn(data, locationId) : []),
  };
}
