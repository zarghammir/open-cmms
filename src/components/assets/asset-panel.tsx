import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * One section of the asset page: either the records, or a stated empty.
 *
 * Two states here, not three, and deliberately: by the time a section renders,
 * the asset itself has already resolved, so its lists are known — they can be
 * empty but they cannot be unknown. The skeleton belongs one level up, on the
 * screen, where the waiting actually happens. A third branch here would be a
 * branch nothing can reach, which is the kind of code that later gets trusted.
 */
export function AssetPanel<T>({
  title,
  description,
  rows,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyBody,
  children,
}: {
  title: string;
  description?: string;
  rows: readonly T[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  children: (rows: readonly T[]) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <EmptyIcon />
              </EmptyMedia>
              <EmptyTitle className="text-base">{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyBody}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          children(rows)
        )}
      </CardContent>
    </Card>
  );
}
