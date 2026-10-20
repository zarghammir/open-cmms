import { Lock, SearchX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The standard screen states. Every module uses these, so "nothing here",
 * "nothing matched" and "not allowed" never look the same and never look like
 * a broken page.
 */

export function LoadingState({ rows = 5 }: { rows?: number }) {
  const t = useTranslations("states.loading");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-3"
    >
      <span className="sr-only">{t("label")}</span>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function NoResultsState({ action }: { action?: ReactNode }) {
  const t = useTranslations("states.noResults");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("title")}</EmptyTitle>
        <EmptyDescription>{t("body")}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function PermissionDeniedState({ roleName }: { roleName: string }) {
  const t = useTranslations("permissions");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("deniedTitle")}</EmptyTitle>
        <EmptyDescription>
          {t("deniedBody", { role: roleName })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs text-muted-foreground">{t("deniedHint")}</p>
      </EmptyContent>
    </Empty>
  );
}

/** Server-rendered variant of the error panel, used by `not-found` screens. */
export function InlineNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
