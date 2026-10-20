"use client";

import { useMemo } from "react";
import {
  workOrderDetail,
  type WorkOrderDetail,
} from "@/data/selectors/work-order-detail";
import {
  hasRecords,
  useDemoData,
  useRepositories,
} from "@/hooks/use-demo-data";
import { useToday } from "@/hooks/use-today";

/**
 * One work order, found by the number a URL carries.
 *
 * Three answers, the same three `useAsset` gives and for the same reason.
 * `unknown` is the moment before the browser has read the records back and
 * draws a skeleton; `missing` is a number this system does not hold, which is
 * somebody following a link that no longer resolves, and it names the number
 * back rather than showing an empty order.
 *
 * The lookup itself is `repositories.workOrders.byNumber`, not a `find` written
 * here. Trimming and case live in the repository where nothing can route around
 * them — a hook that lower-cased its own copy would be a second answer to the
 * same question the first time somebody wrote another caller.
 */
export type WorkOrderLookup =
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "found"; detail: WorkOrderDetail };

export function useWorkOrder(number: string): WorkOrderLookup {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();
  const today = useToday();

  return useMemo<WorkOrderLookup>(() => {
    if (!hasRecords(status) || !repositories || !data) {
      return { state: "unknown" };
    }

    const order = repositories.workOrders.byNumber(number);
    if (!order) return { state: "missing" };

    return { state: "found", detail: workOrderDetail(data, order, today) };
  }, [status, data, repositories, number, today]);
}
