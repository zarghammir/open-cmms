import { useTranslations } from "next-intl";
import { StatusChip } from "@/components/shared/status-chip";
import { INSPECTION_STATUS_PRESENTATION } from "@/domain/constants/inspection-status";
import type { InspectionStatus } from "@/domain/types";

/**
 * An inspection's result, drawn the one way. Same arrangement as the work-order
 * and asset chips: the map carries the tone and the icon, the catalogue carries
 * the word, and a result can never be only a colour — which matters most here,
 * where the difference between passed and failed is the whole point.
 */
export function InspectionStatusChip({ status }: { status: InspectionStatus }) {
  const t = useTranslations("inspectionStatus");
  const { tone, icon } = INSPECTION_STATUS_PRESENTATION[status];

  return <StatusChip tone={tone} icon={icon} label={t(status)} />;
}
