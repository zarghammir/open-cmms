import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * A box whose content can be wider than it is, reachable from the keyboard.
 *
 * **The defect this exists for.** A `div` with `overflow-x-auto` scrolls with a
 * mouse or a finger and cannot be reached any other way: a keyboard user has
 * no way to move it, so the columns past the edge are not merely awkward, they
 * are unreachable. Axe reports it as `scrollable-region-focusable`, serious,
 * and it is invisible until the content is actually wider than the box —
 * which for these panels is a phone-width condition.
 *
 * `tabIndex` is the whole fix: a focusable element scrolls with the arrow
 * keys. The name and the role are the courtesy that stops it being announced
 * as an unlabelled stop on the way through the page, and `role="group"` rather
 * than `region` deliberately — nine named landmarks on one screen is a
 * landmarks list nobody can use, and these are groupings inside a section that
 * already has a heading.
 *
 * **It is a component rather than a class string** because the same wrapper is
 * written out in nine places. One of them was found by a reviewer at 390 and
 * the other eight were not, which is the difference between a defect and a
 * defect that has been noticed: they overflow or not depending on their
 * content, and today's short table is next month's long one.
 */
export function ScrollableRegion({
  label,
  className,
  children,
  ...props
}: {
  /** What the box holds, for somebody who arrives on it by keyboard. */
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<"div">, "children" | "className">) {
  return (
    <div
      data-slot="scrollable-region"
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
