import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingState } from "@/components/shared/state-panels";

/**
 * The shape every panel on a home screen takes: a title, what it is for, and
 * then one of three things — a skeleton while the records are being read, a
 * stated empty state, or the rows.
 *
 * `rows === null` is the first of those, and it is why this takes the list
 * rather than a boolean: the panel cannot be handed an empty array standing in
 * for "not read yet", because there is no empty array to hand it.
 */
export function DashboardPanel<T>({
  title,
  description,
  action,
  rows,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyBody,
  skeletonRows = 3,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  rows: readonly T[] | null;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  skeletonRows?: number;
  children: (rows: readonly T[]) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <LoadingState rows={skeletonRows} />
        ) : rows.length === 0 ? (
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
