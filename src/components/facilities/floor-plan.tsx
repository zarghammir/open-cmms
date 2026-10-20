"use client";

import { useTranslations } from "next-intl";
import {
  MARKER_TONE,
  STATE_ICONS,
} from "@/components/facilities/floor-map-chips";
import type { FloorPlanImage } from "@/domain/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { planLabels, type PlacedAsset } from "@/data/selectors/floor-map";
import { cn } from "cn";

/**
 * The drawing, with a footprint for every machine that stands on it.
 *
 * **Percentages, because the record holds fractions.** The plan is drawn at
 * whatever width the screen gives it — full width on a phone, half of a
 * two-column layout on a desk — and a marker positioned in pixels would be
 * right at exactly one of those widths. The container keeps the drawing's own
 * aspect ratio, so a fraction of the box is a fraction of the drawing at every
 * size.
 *
 * **There is no marker any more. The footprint is the control.** WA-121 draws
 * the plan as an architectural line drawing and gives every tracked machine its
 * true footprint in metres, so the shape on the screen is the shape the machine
 * occupies on the floor — and that shape is the button, filled with its state
 * colour. A dot laid on top of a picture became an object a reader recognises
 * by where it is and how big it is.
 *
 * Three things follow that were previously limitations. The machines whose
 * boxes were too narrow to print a tag — `VAC`, `EWS`, `ALI` — have real shapes
 * instead of icons. The hit area is the equipment rather than a square in the
 * middle of it. And replacing the drawing re-traces footprints instead of
 * re-placing dots, because both come from `floor-geometry.ts`.
 *
 * **Two shapes are symbols and say so.** An interlock panel and a pressure
 * gauge are smaller than any legible outline, so the plan gives them the
 * standard device symbol at `SYMBOL_M` square, exactly as a drawing does. That
 * is declared in the geometry and asserted there, not inferred from size here.
 *
 * The AA criterion is **WCAG 2.2 SC 2.5.8 Target Size (Minimum), 24×24**. The
 * smallest shapes are the two symbols, and the room list beside the plan
 * carries the same selection in full-width rows at least 44 high, which is
 * 2.5.8's equivalent-control route and 2.5.5's AAA size. `floor-map.spec.ts`
 * pins that list's height, which is the part that can rot.
 *
 * **Every marker is a button, and the plan is a list of them.** A person with a
 * keyboard tabs through the machines on the floor in the order the panel lists
 * them and opens each one with the same key they use everywhere else. A drawing
 * with click targets and no focus order is a picture that works for a mouse
 * only, which on a floor plan means the map is unusable by the people most
 * likely to be reading it on a tablet with a keyboard in a plant room.
 */
export function FloorPlan({
  image,
  alt,
  placed,
  selectedId,
  onSelect,
}: {
  image: FloorPlanImage;
  alt: string;
  placed: PlacedAsset[];
  selectedId: string | null;
  onSelect: (placementId: string) => void;
}) {
  const t = useTranslations("floorMap");
  const labels = planLabels(placed);

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border bg-muted"
      style={{ aspectRatio: `${image.widthPx} / ${image.heightPx}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the drawing is a
          fixed static asset of known size, and `next/image` is not used
          anywhere in this application; introducing it for one picture would
          bring a loader and a configuration nothing else needs. */}
      <img
        data-slot="floor-plan-image"
        src={image.path}
        alt={alt}
        width={image.widthPx}
        height={image.heightPx}
        className="absolute inset-0 size-full object-cover"
      />

      <ul className="absolute inset-0">
        {placed.map((one) => {
          const tag = one.asset?.assetTag ?? t("markerUnreadable");
          /*
           * The whole tag names the machine; the drawing prints the short code.
           * `planLabels` falls back to the full tag for every footprint on the
           * floor if two of them would shorten to the same thing.
           */
          const label = one.asset ? (labels.get(tag) ?? tag) : tag;
          const state = t(one.state);
          const selected = one.placement.id === selectedId;
          /*
           * The state carries an icon on the marker itself, not only a tint.
           *
           * A screenshot found this: the tag is what the footprint prints, so
           * on the plan the condition of a machine was conveyed by colour alone
           * — the one thing `StatusChip` exists to make impossible everywhere
           * else. It is also what survives the narrowest shapes: measured at
           * 1280, where the plan is at its smallest beside the panel, the
           * eyewash station is 26 by 26 and the icon is legible in it.
           */
          const StateIcon = STATE_ICONS[one.state];

          return (
            <li key={one.placement.id}>
              {/*
                The vendored tooltip, not a `title`.

                A native tooltip is drawn by the browser's own interface and
                not by the page: it is not in the DOM, a screenshot cannot
                include it, and the only evidence it could ever produce is an
                assertion that an attribute holds a string. This one renders
                where it can be seen, asserted and photographed — and it
                appears on **focus** as well as hover, so the keyboard reader
                gets the same affordance rather than a note in a body saying
                they do not.

                It is portalled, which is the other reason: the plan is
                `overflow-hidden`, and a label drawn inside it would be clipped
                for a marker near an edge — which is where three of this
                floor's small markers sit.
              */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={t("marker", { tag, state })}
                    /*
                     * **The tooltip is drawn, not announced.**
                     *
                     * Radix wires its content as `aria-describedby` on whatever it
                     * wraps, so with a tooltip open this button carried the name
                     * "tag, state" *and* a description resolving to the tag — a
                     * screen reader saying the tag, the state, then the tag again.
                     * The division was supposed to be that the name serves a
                     * reader who cannot see the plan and the tooltip serves a
                     * sighted reader missing the tag; for the first reader the
                     * description is pure repetition, and repetition is what the
                     * division existed to prevent.
                     *
                     * `asChild` merges the child's props over the ones Radix
                     * supplies, so setting this to `undefined` removes the
                     * attribute while leaving the visible tooltip exactly as it
                     * was. Measured on hover and on focus rather than assumed:
                     * `floor-map-markers.spec.ts` reads the accessible name and
                     * the description off the live element and requires the tag to
                     * appear once.
                     */
                    aria-describedby={undefined}
                    onClick={() => onSelect(one.placement.id)}
                    style={{
                      left: `${one.placement.x * 100}%`,
                      top: `${one.placement.y * 100}%`,
                      width: `${one.placement.width * 100}%`,
                      height: `${one.placement.height * 100}%`,
                    }}
                    className={cn(
                      // Square corners: this is a footprint, and equipment does
                      // not have rounded ends. The rounding was a marker's.
                      "@container absolute flex items-center justify-center gap-0.5 border-2 p-0.5 text-[10px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      MARKER_TONE[one.state],
                      selected && "ring-3 ring-ring/60",
                    )}
                  >
                    <StateIcon aria-hidden="true" className="size-3 shrink-0" />
                    {/*
                      The code inside the shape, with no pill behind it. The pill
                      existed because the label sat over a photograph and needed
                      its own background to be readable; over line work it is
                      one more edge competing with the walls.

                      **Shown only where the whole code fits, because half a
                      code is worse than none.** A true footprint is as big as
                      the machine is, so the smallest shapes cannot hold three
                      characters beside an icon, and CSS truncation turned them
                      into `V…`, `R…`, `A…` and `E` — a fragment that reads as a
                      rendering fault rather than as a name. A container query
                      on the footprint itself hides the code below 40px, so what
                      is left is the state icon, which is a symbol and looks
                      like one. The machine is named in the tooltip, in the
                      accessible name and in the panel beside the plan.

                      Measured: at 1024, where the plan is widest because the
                      layout stacks, all eight codes show. At 1280, the
                      narrowest the plan gets, four show and four fall back to
                      the icon. The fallback is never a fragment.
                    */}
                    <span className="hidden truncate font-mono @[2rem]:inline">
                      {label}
                    </span>
                  </button>
                </TooltipTrigger>
                {/*
                  **The tag, and not the whole sentence.**

                  Radix wires its content as `aria-describedby` on the trigger,
                  so whatever is written here is announced after the accessible
                  name. The name already says "tag, state"; repeating that here
                  would have a screen reader read the same sentence twice, which
                  is the hidden-but-announced family in a new place.

                  So the two carry different things on purpose: the **name** is
                  the sentence a reader who cannot see the plan needs, and the
                  **tooltip** is the one fact a sighted reader is missing from
                  an icon-only box — which machine it is. The state is already
                  on the marker as a colour and an icon.

                  `floor-map-markers.spec.ts` pins both the accessible name and
                  the accessible description, so this division is asserted
                  rather than incidental.
                */}
                <TooltipContent>{tag}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
