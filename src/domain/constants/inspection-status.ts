import { CalendarClock, CircleCheck, CirclePlay, CircleX } from "lucide-react";
import type { InspectionStatus } from "@/domain/types/inspection";
import type { StatusPresentation } from "./work-order-status";

/**
 * How an inspection's state is drawn — tone, icon and label key travelling
 * together, the same arrangement as work orders and assets, so `StatusChip`
 * cannot be handed a colour without the two things that make it readable
 * without one.
 *
 * Added by WA-10 so the asset page can show what has been inspected. WA-20 owns
 * inspections and extends this rather than introducing a second way of drawing
 * a result.
 */
export const INSPECTION_STATUS_PRESENTATION: Readonly<
  Record<InspectionStatus, StatusPresentation>
> = {
  scheduled: {
    tone: "neutral",
    icon: CalendarClock,
    labelKey: "inspectionStatus.scheduled",
  },
  inProgress: {
    tone: "info",
    icon: CirclePlay,
    labelKey: "inspectionStatus.inProgress",
  },
  passed: {
    tone: "positive",
    icon: CircleCheck,
    labelKey: "inspectionStatus.passed",
  },
  failed: {
    tone: "critical",
    icon: CircleX,
    labelKey: "inspectionStatus.failed",
  },
};
