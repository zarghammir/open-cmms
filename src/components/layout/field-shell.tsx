import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { FieldNavSheet } from "@/components/layout/field-nav-sheet";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkAxisMark } from "@/components/layout/wordmark";
import type { Role } from "@/domain/constants/roles";

/**
 * Field view: phone first. One bar with the three things that matter in a
 * corridor — how to move, whether there is a signal, and which language — then
 * the work, full width.
 *
 * The bar stays on a light surface: the controls in it are the same ones the
 * desk view uses, and re-tinting each of them for a dark bar is a contrast
 * failure waiting to happen.
 */
export function FieldShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  const tApp = useTranslations("app");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SkipLink />
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
        <FieldNavSheet role={role} />
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <WorkAxisMark className="size-4" />
          </span>
          <span className="hidden truncate font-semibold tracking-tight sm:inline">
            {tApp("name")}
          </span>
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ConnectionStatus />
          {/*
           * The bell belongs here too, and its absence was a real gap rather
           * than a layout choice.
           *
           * A technician is the person "a job has landed on you" exists for,
           * and this shell is the only one they ever see — so the alert fired,
           * the notice was written, and there was nowhere on their screen to
           * read it. Found by the browser test for that rule failing to find
           * the control at all, which is the shape a missing surface takes:
           * not a wrong answer, no answer.
           */}
          <NotificationsBell role={role} />
          <LocaleSwitcher />
          <UserMenu role={role} />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        aria-label={t("mainContent")}
        className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-4 pb-10"
      >
        {children}
      </main>
    </div>
  );
}
