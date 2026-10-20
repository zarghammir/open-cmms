"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

/**
 * A labelled control with its error.
 *
 * Written here rather than pulled from the registry: the whole of it is a
 * label, a description and an error tied together with ids, and vendoring a
 * component to do that would be more code to own, not less.
 *
 * The error is `role="alert"` and referenced by `aria-describedby`, so it is
 * announced when it appears and read out when the field takes focus.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A native select.
 *
 * Deliberately native. On a phone it gives the platform picker a technician
 * already knows, it needs no JavaScript to be usable, and it costs nothing to
 * make accessible — none of which is true of a custom listbox.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        // The disabled styling matches the vendored `Input` exactly. WA-67 put
        // the create form inside a `disabled` fieldset while a write is in
        // flight, and only `Input` said so — so in the ticket's own screenshot
        // the Title field was greyed and the Description beside it was black,
        // five of the eight controls dead but looking live. A control that is
        // disabled and does not look it is worse than one that is not
        // disabled: a person types into it and nothing happens.
        "h-8 w-full rounded-md border border-border bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A plain `<textarea>`, styled to match `Input` and `Select`.
 *
 * Not the registry's `Textarea`, for the reason AGENTS.md gives for the select:
 * a vendored component would be a third file to keep in step for markup that is
 * one element and one class list. It lives here beside `Select` so the two
 * controls this module owns are in one place, and so a screen never writes the
 * class list out by hand — WA-39 had it duplicated across two dialogs before
 * this existed.
 */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Same disabled styling as `Select` and the vendored `Input`; see the
        // note there.
        "w-full rounded-md border border-border bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
