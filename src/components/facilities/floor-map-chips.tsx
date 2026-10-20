"use client";

import {
  CircleCheck,
  FileQuestion,
  PackageX,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { FloorMapState } from "@/data/selectors/floor-map";

/**
 * What an outline on the plan means, said in words.
 *
 * The marker on the drawing carries a colour, and a colour on its own is not a
 * signal — the same rule `StatusChip` enforces everywhere else by requiring a
 * label and an icon. So every marker names its state here as well, on the
 * marker itself where there is room and in the panel beside it always.
 */

const TONES: Record<FloorMapState, StatusTone> = {
  overdue: "critical",
  open: "info",
  // The tone the rest of the application already uses for a shelf that needs
  // attention but has not stopped anything yet.
  lowStock: "attention",
  clear: "positive",
  // Not "quiet": a marker nobody can read is not a calm one. It is the state
  // that needs looking at, and the panel says so in its own words.
  unreadable: "neutral",
};

export const STATE_ICONS = {
  overdue: TriangleAlert,
  open: Wrench,
  lowStock: PackageX,
  clear: CircleCheck,
  unreadable: FileQuestion,
} as const;

export function FloorMapStateChip({ state }: { state: FloorMapState }) {
  const t = useTranslations("floorMap");

  return (
    <StatusChip
      tone={TONES[state]}
      icon={STATE_ICONS[state]}
      label={t(state)}
    />
  );
}

/** The marker's own tint, kept beside the chip's tone so the two agree. */
export const MARKER_TONE: Record<FloorMapState, string> = {
  overdue: "border-status-critical bg-status-critical/25 text-status-critical",
  open: "border-status-info bg-status-info/25 text-status-info",
  lowStock:
    "border-status-attention bg-status-attention/25 text-status-attention",
  clear: "border-status-positive bg-status-positive/20 text-status-positive",
  unreadable: "border-status-neutral bg-status-neutral/20 text-status-neutral",
};
