import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  const t = useTranslations("shell.breadcrumb");

  return (
    <nav
      aria-label={t("label")}
      data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      data-slot="breadcrumb-link"
      /*
       * `min-h-6` — twenty-four pixels — and it is height rather than type.
       *
       * At 390 this link measured 19.5 px on twelve screens, which is the one
       * small target a person meets on *every* screen. The tender names WCAG
       * 2.1 AA, which has no target-size criterion at all — 2.5.5 is AAA at 44
       * and the 24 px floor is 2.2's 2.5.8 — so this is not a failure of the
       * named standard. It is a thumb on a phone in a plant room, and it costs
       * four pixels.
       *
       * A minimum height with `inline-flex` rather than padding, so the text
       * keeps its size and its baseline: padding would have moved the words
       * relative to the separator beside them. The headers this sits in are a
       * fixed `h-14`, so nothing above or below moves.
       */
      className={cn(
        "inline-flex min-h-6 items-center transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      // The current page carries `role="link"` and is announced as one, so it
      // gets the same box as the link beside it — a row of links where one is
      // shorter than the others reads as a mistake before it reads as a state.
      className={cn(
        "inline-flex min-h-6 items-center font-normal text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const t = useTranslations("common");

  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">{t("more")}</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
