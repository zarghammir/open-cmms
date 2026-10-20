import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

/**
 * The signal tones. A tone is never enough on its own: `icon` and `label` are
 * both required props, so it is not possible to express a status by colour
 * alone anywhere in the application. WA-26 maps work-order statuses and
 * priorities onto these tones.
 */
export type StatusTone =
  | "neutral"
  | "info"
  | "attention"
  | "waiting"
  | "positive"
  | "quiet"
  | "critical";

const toneClasses: Record<StatusTone, string> = {
  neutral: "text-status-neutral border-status-neutral/30 bg-status-neutral/8",
  info: "text-status-info border-status-info/30 bg-status-info/8",
  attention:
    "text-status-attention border-status-attention/30 bg-status-attention/8",
  waiting: "text-status-waiting border-status-waiting/30 bg-status-waiting/8",
  positive:
    "text-status-positive border-status-positive/30 bg-status-positive/8",
  quiet: "text-status-quiet border-status-quiet/30 bg-status-quiet/8",
  critical:
    "text-status-critical border-status-critical/30 bg-status-critical/8",
};

interface StatusChipProps {
  tone: StatusTone;
  /** Always shown. Screen readers and monochrome printouts rely on it. */
  label: string;
  /** Always shown, so the tone is never the only distinguishing feature. */
  icon: LucideIcon;
  className?: string;
}

export function StatusChip({
  tone,
  label,
  icon: Icon,
  className,
}: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
