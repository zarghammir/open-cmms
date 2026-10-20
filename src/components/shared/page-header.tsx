import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Short, uppercase context line. Set in mono, the way a nameplate is. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Primary and secondary actions for the page. */
  actions?: ReactNode;
}

/**
 * Every screen opens the same way: where you are, what this screen is for, and
 * what you can do here.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-2xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
