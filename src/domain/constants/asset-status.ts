import {
  Circle,
  CircleCheck,
  CircleSlash,
  ChevronDown,
  ChevronUp,
  Equal,
  TriangleAlert,
} from "lucide-react";
import type { AssetCriticality, AssetStatus } from "@/domain/types/asset";
import type { StatusPresentation } from "./work-order-status";

export const ASSET_STATUS_PRESENTATION: Readonly<
  Record<AssetStatus, StatusPresentation>
> = {
  active: {
    tone: "positive",
    icon: CircleCheck,
    labelKey: "assetStatus.active",
  },
  inactive: { tone: "quiet", icon: Circle, labelKey: "assetStatus.inactive" },
  decommissioned: {
    tone: "neutral",
    icon: CircleSlash,
    labelKey: "assetStatus.decommissioned",
  },
};

export const ASSET_CRITICALITY_PRESENTATION: Readonly<
  Record<AssetCriticality, StatusPresentation>
> = {
  critical: {
    tone: "critical",
    icon: TriangleAlert,
    labelKey: "criticality.critical",
  },
  high: { tone: "attention", icon: ChevronUp, labelKey: "criticality.high" },
  medium: { tone: "neutral", icon: Equal, labelKey: "criticality.medium" },
  low: { tone: "quiet", icon: ChevronDown, labelKey: "criticality.low" },
};
