import {
  CIRCULATION,
  DOORS,
  FIXTURES,
  PLAN,
  ORIGIN_XM,
  PX_PER_M,
  ROOMS,
  WALL,
  toPx,
  type RectM,
} from "./floor-geometry";

/**
 * The floor plan, drawn from the geometry rather than painted.
 *
 * **Line work, because a plan is a drawing and not a photograph.** What this
 * replaces was a rendered picture of a room seen from above: shading, texture
 * and a hint of perspective, with markers laid on top of it. A reader saw an
 * image of equipment; what a plan gives them is the shape a thing occupies and
 * where it stands, which is the question somebody standing in the building is
 * actually asking.
 *
 * **Walls are poché, which is the convention and also the cheapest honest
 * drawing.** A wall is filled solid between its two faces rather than drawn as
 * two lines, so thickness reads at any size and nothing depends on a hairline
 * surviving a scale-down to a phone.
 *
 * **What is deliberately not here: the machines.** Their footprints are drawn
 * by `floor-plan.tsx` from the placement records, because the footprint is the
 * clickable region and the state colour fills it. Drawing them here as well
 * would put the same rectangle in two places and let the picture and the
 * records disagree — which is exactly the defect this ticket exists to end.
 * The drawing holds what does not change: walls, doors, services, room numbers.
 */

const INK = "#1f2937";
const LINE = "#6b7280";
/** Used once, for the exit route, which is the one thing a plan shouts. */
const EXIT = "#b91c1c";

function rect(r: RectM, attrs: string): string {
  const { x, y, width, height } = toPx(r);
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" ${attrs}/>`;
}

function round(value: number): number {
  // Whole pixels where the scale allows it, two decimals where it does not, so
  // the committed file does not carry floating-point noise from run to run.
  return Math.round(value * 100) / 100;
}

/**
 * Metres to pixels on the x axis, origin included.
 *
 * The canvas starts a metre west of the building so the exit leaf has somewhere
 * to swing, so a raw `xM * PX_PER_M` is a metre out. One helper rather than a
 * subtraction at each call site: there were five, and the one that forgets is
 * the one nobody looks at.
 */
function px(xM: number): number {
  return round((xM - ORIGIN_XM) * PX_PER_M);
}

function py(yM: number): number {
  return round(yM * PX_PER_M);
}

function polar(xM: number, yM: number, radiusM: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: px(xM + radiusM * Math.cos(rad)),
    y: py(yM + radiusM * Math.sin(rad)),
  };
}

/**
 * One door: the leaf standing open, and the arc it sweeps to get there.
 *
 * The arc is what tells a reader which way the door swings and how much floor
 * it needs, and it is the detail that most says "this is a plan". `sweep` is
 * derived from the direction of travel rather than written down, because a
 * hand-written sweep flag that disagrees with the angles draws the arc the long
 * way round — 270 degrees of it — and looks like a mistake nobody can name.
 */
function door(one: (typeof DOORS)[number]): string {
  const hinge = polar(one.xM, one.yM, 0, 0);
  const shut = polar(one.xM, one.yM, one.widthM, one.fromDeg);
  const open = polar(one.xM, one.yM, one.widthM, one.toDeg);
  const delta = ((one.toDeg - one.fromDeg + 360) % 360) as number;
  const sweep = delta <= 180 ? 1 : 0;
  const radius = round(one.widthM * PX_PER_M);

  return [
    // The hole through the wall, so the two rooms visibly connect.
    rect(one.opening, `fill="#ffffff"`),
    `<line x1="${hinge.x}" y1="${hinge.y}" x2="${open.x}" y2="${open.y}" stroke="${INK}" stroke-width="2.5" stroke-linecap="square"/>`,
    `<path d="M ${shut.x} ${shut.y} A ${radius} ${radius} 0 0 ${sweep} ${open.x} ${open.y}" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="4 3"/>`,
  ].join("\n    ");
}

function fixture(one: (typeof FIXTURES)[number]): string {
  if (one.kind === "drain") {
    const { x, y, width, height } = toPx(one);
    // A floor drain is a square with its diagonals, which is the symbol for it.
    return [
      rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`),
      `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x + width)}" y2="${round(y + height)}" stroke="${LINE}" stroke-width="1"/>`,
      `<line x1="${round(x + width)}" y1="${round(y)}" x2="${round(x)}" y2="${round(y + height)}" stroke="${LINE}" stroke-width="1"/>`,
    ].join("\n    ");
  }

  if (one.kind === "stair") {
    const { x, y, width, height } = toPx(one);
    // Treads across the run, which is how a plan says "stair" without a word.
    const treads = 8;
    const lines = Array.from({ length: treads - 1 }, (_, index) => {
      const at = round(x + (width / treads) * (index + 1));
      return `<line x1="${at}" y1="${round(y)}" x2="${at}" y2="${round(y + height)}" stroke="${LINE}" stroke-width="1"/>`;
    });
    return [
      rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`),
      ...lines,
    ].join("\n    ");
  }

  if (one.kind === "riser") {
    // A riser is a shaft: crossed, like a void, because nothing stands in it.
    const { x, y, width, height } = toPx(one);
    return [
      rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`),
      `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x + width)}" y2="${round(y + height)}" stroke="${LINE}" stroke-width="1"/>`,
    ].join("\n    ");
  }

  if (one.kind === "hatch") {
    // A pass-through cabinet, drawn white against the partition it passes
    // through, so the wall reads as broken by it rather than behind it.
    return rect(one, `fill="#ffffff" stroke="${INK}" stroke-width="1.5"`);
  }

  if (one.kind === "shelving") {
    const { x, y, width, height } = toPx(one);
    // Shelving is drawn as a bay: the outline with its divisions.
    const bays = 3;
    const lines = Array.from({ length: bays - 1 }, (_, index) => {
      const at = round(x + (width / bays) * (index + 1));
      return `<line x1="${at}" y1="${round(y)}" x2="${at}" y2="${round(y + height)}" stroke="${LINE}" stroke-width="1"/>`;
    });
    return [
      rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`),
      ...lines,
    ].join("\n    ");
  }

  if (one.kind === "sink") {
    const { x, y, width, height } = toPx(one);
    const inset = 6;
    return [
      rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`),
      `<rect x="${round(x + inset)}" y="${round(y + inset)}" width="${round(width - inset * 2)}" height="${round(height - inset * 2)}" rx="3" fill="none" stroke="${LINE}" stroke-width="1"/>`,
    ].join("\n    ");
  }

  return rect(one, `fill="none" stroke="${LINE}" stroke-width="1.5"`);
}

/** A wall band: the solid between two faces. */
function wall(r: RectM): string {
  return rect(r, `fill="${INK}"`);
}

function roomLabel(text: string, r: RectM): string {
  // The number only. A plan labels a room with what is painted on its door, and
  // the panel beside the map carries the rest.
  const x = px(r.xM + r.widthM - 0.35);
  const y = py(r.yM + r.depthM - 0.35);
  return `<text x="${x}" y="${y}" text-anchor="end" font-family="ui-monospace, monospace" font-size="26" fill="${LINE}">${text}</text>`;
}

export function drawFloorPlanSvg(): string {
  const outer = WALL.outerM;
  const parts: string[] = [];

  // The slab, then the walls on top of it, then everything that cuts through.
  parts.push(
    `<rect x="0" y="0" width="${PLAN.widthPx}" height="${PLAN.heightPx}" fill="#ffffff"/>`,
  );

  // Outer wall, drawn as four bands rather than a stroked frame so the corners
  // are solid and the thickness is a measurement rather than a stroke width.
  parts.push(
    wall({ xM: 0, yM: 0, widthM: PLAN.widthM, depthM: outer }),
    wall({
      xM: 0,
      yM: PLAN.heightM - outer,
      widthM: PLAN.widthM,
      depthM: outer,
    }),
    wall({ xM: 0, yM: 0, widthM: outer, depthM: PLAN.heightM }),
    wall({
      xM: PLAN.widthM - outer,
      yM: 0,
      widthM: outer,
      depthM: PLAN.heightM,
    }),
  );

  // The wall between the rooms and the corridor, and the partition between the
  // two rooms.
  parts.push(
    wall({ xM: 0.3, yM: 7.6, widthM: 17.4, depthM: WALL.partitionM }),
    wall({ xM: 9.4, yM: 0.3, widthM: WALL.partitionM, depthM: 7.3 }),
  );

  // The airlock, walled out of 187's south-east corner.
  const air = CIRCULATION.airlock;
  parts.push(
    wall({
      xM: air.xM - WALL.partitionM,
      yM: air.yM - WALL.partitionM,
      widthM: WALL.partitionM,
      depthM: air.depthM + WALL.partitionM,
    }),
    wall({
      xM: air.xM - WALL.partitionM,
      yM: air.yM - WALL.partitionM,
      widthM: air.widthM + WALL.partitionM * 2,
      depthM: WALL.partitionM,
    }),
    wall({
      xM: air.xM + air.widthM,
      yM: air.yM - WALL.partitionM,
      widthM: WALL.partitionM,
      depthM: air.depthM + WALL.partitionM,
    }),
  );

  for (const one of FIXTURES) parts.push(fixture(one));
  for (const one of DOORS) parts.push(door(one));

  for (const [code, r] of Object.entries(ROOMS)) {
    parts.push(roomLabel(code.slice(code.lastIndexOf("-") + 1), r));
  }
  // The airlock has no room number of its own; a plan still names it, briefly.
  parts.push(roomLabel("AL", air));

  /*
   * The exit route: the one red thing, and the one a plan is required to show.
   *
   * **It runs to the door now.** It used to stop at 1.4 m, a metre and a bit
   * short, because the exit leaf swung east into the corridor and occupied that
   * floor. With the leaf swinging out there is nothing in the way, and a route
   * that stops short of the door it points at is the same class of defect as
   * the arrow that pointed away from it — read straight off the drawing, not
   * reachable by any assertion.
   */
  const exitY = py(8.85);
  parts.push(
    `<line x1="${px(0.35)}" y1="${exitY}" x2="${px(5.2)}" y2="${exitY}" stroke="${EXIT}" stroke-width="2" stroke-dasharray="10 6"/>`,
    // Pointing west, at the stair door. The head was drawn east — away from
    // the only exit on the floor — which is the sort of thing a plan is read
    // for and no assertion about line work would ever have caught.
    `<path d="M ${px(0.35)} ${exitY} l 18 -8 v 16 z" transform="rotate(180 ${px(0.35)} ${exitY})" fill="${EXIT}"/>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLAN.widthPx} ${PLAN.heightPx}" width="${PLAN.widthPx}" height="${PLAN.heightPx}" role="img">`,
    `  <!-- Generated from src/data/seed/floor-geometry.ts by floor-drawing.ts.`,
    `       Regenerate: WA_DRAW_FLOOR=1 npx vitest run src/data/seed/floor-drawing.test.ts`,
    `       Do not hand-edit: floor-drawing.test.ts compares this file with the`,
    `       geometry and fails when they disagree. -->`,
    ...parts.map((one) => `  ${one}`),
    `</svg>`,
    ``,
  ].join("\n");
}
