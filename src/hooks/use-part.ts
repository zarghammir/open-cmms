"use client";

import { useMemo } from "react";
import { partDetail, type PartDetail } from "@/data/selectors/part-detail";
import {
  hasRecords,
  useDemoData,
  useRepositories,
} from "@/hooks/use-demo-data";

/**
 * One part, found by the stock number a URL carries.
 *
 * Three answers, the same three `useWorkOrder` and `useAsset` give and for the
 * same reason. `unknown` is the moment before the browser has read the records
 * back and draws a skeleton; `missing` is a stock number this system does not
 * hold, which is somebody following a link or a scan that resolves to nothing,
 * and it names the number back rather than drawing an empty part.
 *
 * The lookup is `repositories.parts.byNumber`, not a `find` written here, so
 * trimming and case live in one place that nothing can route around.
 *
 * `low` comes from `parts.belowMinimum()` rather than from a comparison written
 * here. When this was written that comparison was spelled out in three separate
 * places and this hook owed it not to become the fourth; since WA-69 it has one
 * home, `isBelowMinimum` in `domain/constants/part.ts`, and a hook that wrote it
 * out again would be the second — which is the thing the consolidation exists to
 * prevent.
 */
export type PartLookup =
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "found"; detail: PartDetail; low: boolean };

export function usePart(partNumber: string): PartLookup {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();

  return useMemo<PartLookup>(() => {
    if (!hasRecords(status) || !repositories || !data) {
      return { state: "unknown" };
    }

    const part = repositories.parts.byNumber(partNumber);
    if (!part) return { state: "missing" };

    return {
      state: "found",
      detail: partDetail(data, part),
      low: repositories.parts
        .belowMinimum()
        .some((candidate) => candidate.id === part.id),
    };
  }, [status, data, repositories, partNumber]);
}
