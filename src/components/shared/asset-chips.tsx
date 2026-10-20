import { useTranslations } from "next-intl";
import { StatusChip } from "@/components/shared/status-chip";
import {
  ASSET_CRITICALITY_PRESENTATION,
  ASSET_STATUS_PRESENTATION,
} from "@/domain/constants/asset-status";
import type { AssetCriticality, AssetStatus } from "@/domain/types";

/**
 * An asset's status and criticality, drawn the one way — the same arrangement
 * as `work-order-chips.tsx`, for the same reason: the tone and the icon come
 * from the presentation map, the label from the catalogue namespace that map
 * names, and `StatusChip` will not render a tone without both.
 *
 * `asset-chips.test.tsx` holds the map's `labelKey` and the namespace used here
 * against each other, so repointing one without the other fails.
 */

export function AssetStatusChip({ status }: { status: AssetStatus }) {
  const t = useTranslations("assetStatus");
  const { tone, icon } = ASSET_STATUS_PRESENTATION[status];

  return <StatusChip tone={tone} icon={icon} label={t(status)} />;
}

export function AssetCriticalityChip({
  criticality,
}: {
  criticality: AssetCriticality;
}) {
  const t = useTranslations("criticality");
  const { tone, icon } = ASSET_CRITICALITY_PRESENTATION[criticality];

  return <StatusChip tone={tone} icon={icon} label={t(criticality)} />;
}
