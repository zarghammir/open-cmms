"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Toggle as TogglePrimitive } from "radix-ui";

/**
 * How a pressed item looks, in one place so it can be swapped in one edit.
 *
 * **The state was a 1.15:1 fill and nothing else.** The vendored component's
 * only state-dependent rule was `data-[state=on]:bg-muted`, and `--muted` is
 * `#edf0ee`: 1.15:1 against the card white the header sits on, 1.06:1 against
 * the page. WCAG 2.1 1.4.11 asks for 3:1 for the visual cue that identifies a
 * component's state, and five call sites depended on this one rule — the
 * language switcher in the header of every screen, the reports selector,
 * Map | List, visits | month, and the asset edit dialog. None added a cue of
 * its own.
 *
 * Axe never saw it: its `color-contrast` rule is 1.4.3, which is about text.
 * A green scan was silence, not clearance.
 *
 * **A fill, not a tint.** `--primary` on `--primary-foreground` reverses the
 * item: 11.07:1 against the card, 10.20:1 against the page, 9.65:1 against a
 * neighbour being hovered. It is a luminance change rather than a hue change,
 * so it survives greyscale and every kind of colour blindness — which is what
 * "not by colour alone" has to mean for a fill.
 *
 * The hover rules are repeated for the pressed state on purpose: `hover:` and
 * `data-[state=on]:` generate classes of equal specificity, so which wins is
 * decided by the order Tailwind emits them and not by the order they are
 * written here. Stating both leaves nothing to that order.
 *
 * The owner may still prefer a border plus a check mark. That is this constant
 * and nothing else.
 */
const PRESSED_STATE = [
  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
  "data-[state=on]:border-primary",
  "data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground",
  "aria-pressed:bg-primary aria-pressed:text-primary-foreground",
  "aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground",
].join(" ");

const toggleVariants = cva(
  `group/toggle ${PRESSED_STATE} inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
