import type { LucideIcon } from "lucide-react";
import { useFormatter } from "next-intl";
import { cn } from "cn";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

/**
 * One headline number, and the way into the records behind it.
 *
 * `value` is null while the records are still being read. A card that drew a
 * zero in that moment would be making a claim — "nothing is overdue" — before
 * anything had been counted, and a reviewer would have no way to tell the
 * difference between a quiet morning and an unfinished load.
 *
 * `emphasis` tints the number, and never alone: the label says what it counts
 * and the icon repeats it, so the card reads the same in monochrome.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  query,
  emphasis = false,
  testId,
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  href: string;
  query?: Record<string, string>;
  emphasis?: boolean;
  /** So the browser suite can read the number rather than the whole card. */
  testId: string;
}) {
  const format = useFormatter();
  const raised = emphasis && value !== null && value > 0;

  return (
    <Card className="p-0">
      <Link
        href={{ pathname: href, query }}
        className="flex h-full flex-col gap-2 rounded-lg p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
        {value === null ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <span
            data-testid={testId}
            className={cn(
              "text-3xl leading-none tabular-nums",
              raised && "text-status-critical",
            )}
          >
            {format.number(value, "integer")}
          </span>
        )}
      </Link>
    </Card>
  );
}
