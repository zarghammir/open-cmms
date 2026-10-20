/**
 * The drawn floor, in metres, as the one description the plan and the records
 * both come from.
 *
 * **Why metres and not fractions.** A placement is stored as a fraction of the
 * drawing, which is right for rendering and useless for deciding whether a
 * shape is the size the machine is. WA-121 asks for true footprints, and "true"
 * is a claim about metres. So the sizes are written here in metres, the
 * fractions are derived, and `floor-geometry.test.ts` can check a footprint
 * against the equipment it stands for rather than against itself.
 *
 * **Why the drawing is generated from this file.** The plan used to be a
 * rendered picture with markers laid on top, and the two could disagree without
 * anything noticing — the picture showed eight rooms while the records held
 * two. Here the rooms, the walls and the doors are data, `floor-drawing.ts`
 * emits the SVG from them behind `WA_DRAW_FLOOR=1`, and `floor-drawing.test.ts`
 * reads the committed file back and requires it to match. The drawing cannot
 * drift from the floor it is of.
 *
 * **Scale.** 75 pixels to the metre, so 18.0 m × 10.0 m is 1350 × 750. The
 * number is chosen to be exact rather than convenient: every coordinate below
 * is a round number of centimetres, and every derived pixel is a whole pixel.
 */

/** Pixels per metre in the drawing's own coordinate system. */
export const PX_PER_M = 75;

/**
 * The drawing's extent, which is the building **plus a metre of outside**.
 *
 * **The metre is there so the exit door can swing out.** Every other door on
 * this floor opens into the space it serves and out of the corridor; the exit
 * did the opposite, opening back against the direction of escape, because the
 * canvas stopped exactly at the envelope and an outward leaf had nowhere to be
 * drawn. A plan shows that leaf outside the building, so the canvas has to
 * contain some outside.
 *
 * The building has not moved. Every room, footprint and fixture keeps the metres
 * it had; only the frame around them is wider, and `ORIGIN_XM` is what the
 * fraction and pixel conversions subtract so the two coordinate systems cannot
 * drift apart.
 */
export const ORIGIN_XM = -1.0;

/** The floor's extent, walls included, plus that metre. */
export const PLAN = {
  widthM: 19.0,
  heightM: 10.0,
  get widthPx() {
    return this.widthM * PX_PER_M;
  },
  get heightPx() {
    return this.heightM * PX_PER_M;
  },
} as const;

/** Wall thicknesses, drawn as double lines at these widths. */
export const WALL = { outerM: 0.3, partitionM: 0.2 } as const;

export interface RectM {
  xM: number;
  yM: number;
  widthM: number;
  depthM: number;
}

/**
 * The two rooms this floor has.
 *
 * **Two, because that is what the records say.** A room's floor is the first
 * digit of its number, so `MCT-B01` puts 127 and 187 on F1 and 262, 264, 296
 * and 376 elsewhere. The drawing this replaces showed eight rooms, which is a
 * picture disagreeing with the panel beside it.
 */
export const ROOMS: Record<string, RectM> = {
  // The plant room: the machines that serve the suite.
  "MCT-B01-127": { xM: 0.3, yM: 0.3, widthM: 9.1, depthM: 7.3 },
  // The containment suite, entered through the airlock.
  "MCT-B01-187": { xM: 9.6, yM: 0.3, widthM: 8.1, depthM: 7.3 },
};

/** The corridor both rooms open off, and the airlock that serves 187. */
export const CIRCULATION = {
  corridor: { xM: 0.3, yM: 7.8, widthM: 17.4, depthM: 1.9 },
  /** Carved out of 187's south side; the interlock is what makes it an airlock. */
  airlock: { xM: 12.0, yM: 5.7, widthM: 2.4, depthM: 1.9 },
} as const;

/**
 * A door: the gap it makes in the wall, and the quarter-turn its leaf sweeps.
 *
 * Angles are degrees in the drawing's own frame, where y runs down: 0 is east,
 * 90 south, 180 west, 270 north. `fromDeg` is the leaf shut against the wall
 * and `toDeg` is it standing open, which is the position a plan draws it in.
 * Written as angles rather than as a compass word and a handedness because the
 * arc needs two numbers and deriving them from words was a second thing to get
 * wrong.
 */
export interface DoorM {
  /** Hinge point. */
  xM: number;
  yM: number;
  /** Leaf length, which is also the swing radius. */
  widthM: number;
  fromDeg: number;
  toDeg: number;
  /** The hole the door makes, which is drawn through the wall. */
  opening: RectM;
}

export const DOORS: DoorM[] = [
  // Room 127 off the corridor, at the clear stretch of wall east of the bench
  // run. It was at 2.0 and swung straight into the bench, which is the kind of
  // thing a plan is drawn to make visible.
  {
    xM: 8.1,
    yM: 7.6,
    widthM: 0.9,
    fromDeg: 180,
    toDeg: 270,
    opening: { xM: 7.2, yM: 7.6, widthM: 0.9, depthM: 0.2 },
  },
  // Corridor into the airlock, and the airlock into 187. Two leaves is the
  // point of an airlock: the interlock stops both being open at once, which is
  // what `ALI-MCT-11` is and why it is drawn beside this pair.
  {
    xM: 13.3,
    yM: 7.6,
    widthM: 0.9,
    fromDeg: 180,
    toDeg: 270,
    opening: { xM: 12.4, yM: 7.6, widthM: 0.9, depthM: 0.2 },
  },
  {
    xM: 13.5,
    yM: 5.7,
    widthM: 0.9,
    fromDeg: 0,
    toDeg: 270,
    opening: { xM: 13.5, yM: 5.5, widthM: 0.9, depthM: 0.2 },
  },
  /*
   * The way out at the west end of the corridor, which is where the exit route
   * leads. The stair itself is at the east end.
   *
   * **It swings out, and it used to swing in.** The other three doors open into
   * the space they serve and leave the corridor clear; this one opened east into
   * the corridor, across the path somebody leaving would take. Nothing collided,
   * so the sweep check passed and was right to — the leaf hits nothing. The
   * defect was that the drawing set a convention on three doors and broke it on
   * the fourth, and broke it on the one door where the direction of travel is
   * the whole point.
   *
   * Consistency is the argument being made here, not compliance: whether an
   * outward swing is required depends on occupant load, and that is a building
   * official's judgement rather than this repository's.
   */
  {
    xM: 0.0,
    yM: 8.4,
    widthM: 0.9,
    fromDeg: 90,
    toDeg: 180,
    opening: { xM: 0.0, yM: 8.4, widthM: 0.3, depthM: 0.9 },
  },
];

/**
 * Fixed services: drawn, not tracked.
 *
 * These are the benches, sinks, drains, shelving, risers, hatches and the stair
 * that let a reader tell a room's use at a glance. Nothing here is a record, nothing here is clickable,
 * and a test asserts none of them shares a position with a tracked machine —
 * otherwise a fixture would sit under a footprint and look like a dead target.
 */
export type FixtureKind =
  "bench" | "sink" | "drain" | "shelving" | "riser" | "hatch" | "stair";

/**
 * **Each one at its own size, which is the owner's point about the reference.**
 * A repeated icon tells a reader "something is here"; a footprint tells them
 * what and how much room it takes. So no two of these are the same rectangle
 * unless the objects really are, and `floor-geometry.test.ts` counts the
 * distinct sizes to keep it that way — a drawing that has drifted back to one
 * stamped shape reds there rather than being noticed by somebody's eye.
 */
export const FIXTURES: (RectM & { kind: FixtureKind })[] = [
  // Room 127, the plant room: a run of bench with the sink at its end, parts
  // shelving on the short wall, the riser that feeds the floor, and a drain.
  { kind: "bench", xM: 0.8, yM: 6.2, widthM: 4.2, depthM: 0.75 },
  { kind: "sink", xM: 5.4, yM: 6.2, widthM: 1.0, depthM: 0.75 },
  { kind: "bench", xM: 3.0, yM: 3.4, widthM: 2.6, depthM: 0.7 },
  { kind: "shelving", xM: 7.4, yM: 0.7, widthM: 1.7, depthM: 0.45 },
  { kind: "riser", xM: 8.6, yM: 3.0, widthM: 0.7, depthM: 0.7 },
  { kind: "drain", xM: 6.6, yM: 5.0, widthM: 0.35, depthM: 0.35 },

  // Room 187, the containment suite: the pass-through hatch in the partition,
  // a wash trough, bench along the east wall, shelving, and the suite drain.
  { kind: "hatch", xM: 9.6, yM: 2.9, widthM: 0.4, depthM: 0.6 },
  { kind: "sink", xM: 15.8, yM: 3.0, widthM: 1.6, depthM: 0.65 },
  { kind: "bench", xM: 15.4, yM: 0.4, widthM: 2.0, depthM: 0.75 },
  { kind: "shelving", xM: 15.8, yM: 5.0, widthM: 1.6, depthM: 0.5 },
  { kind: "drain", xM: 12.8, yM: 3.4, widthM: 0.4, depthM: 0.4 },

  // The airlock: a gowning bench, which is what the room is for. Against the
  // north wall, because on the south it stood in the door's swing.
  { kind: "bench", xM: 12.2, yM: 5.9, widthM: 2.0, depthM: 0.4 },

  // The corridor: the stair the exit route leads away from.
  { kind: "stair", xM: 15.0, yM: 8.0, widthM: 2.4, depthM: 1.5 },
];

/**
 * Every tracked machine on this floor, at the size it really is.
 *
 * **Two size classes, which is what a plan does.** Plant is drawn as its own
 * footprint at scale. A wall device — an interlock panel, a pressure gauge — is
 * smaller than any legible symbol, so a real drawing gives it a standard symbol
 * rather than shrinking it to a speck. Those carry `symbol: true`, and the
 * difference is asserted rather than assumed: a symbol is exactly `SYMBOL_M`
 * square and a scale footprint must be **strictly larger** than one — at the
 * boundary the two are indistinguishable on the screen, so a shape that has
 * shrunk to symbol size has become a symbol and has to say so.
 *
 * Marking it in the data rather than inferring it from size keeps the claim
 * honest. A reader can see which shapes are scale drawings and which are
 * conventions, and so can a test.
 */
/**
 * **1.2 m, and it was 0.8 until the browser said so.** A symbol is a convention
 * rather than a measurement, so its size is chosen — and the thing it has to be
 * chosen against is the smallest width the plan is drawn at. At 0.8 the two
 * device symbols rendered 15x15 at 1024, well under WCAG 2.2 SC 2.5.8's 24x24,
 * which `floor-map-markers.spec.ts` measured rather than anybody predicting.
 */
export const SYMBOL_M = 1.2;

export interface FootprintM extends RectM {
  /** The asset tag this shape stands for. */
  tag: string;
  /** The room it stands in; a test requires the shape to be inside it. */
  room: string;
  /** True when the shape is a device symbol rather than a scale footprint. */
  symbol?: true;
}

export const FOOTPRINTS: FootprintM[] = [
  // Room 127, the plant room.
  {
    tag: "AHU-MCT-11",
    room: "MCT-B01-127",
    xM: 0.8,
    yM: 0.7,
    widthM: 3.0,
    depthM: 1.6,
  },
  {
    tag: "AUT-MCT-11",
    room: "MCT-B01-127",
    xM: 5.2,
    yM: 0.7,
    widthM: 1.8,
    depthM: 1.2,
  },
  {
    tag: "VAC-MCT-11",
    room: "MCT-B01-127",
    xM: 0.8,
    yM: 3.2,
    widthM: 1.2,
    depthM: 1.0,
  },
  // Room 187, the containment suite.
  {
    tag: "EDS-MCT-11",
    room: "MCT-B01-187",
    xM: 10.1,
    yM: 0.7,
    widthM: 2.4,
    depthM: 1.8,
  },
  {
    tag: "DHU-MCT-11",
    room: "MCT-B01-187",
    xM: 13.6,
    yM: 0.7,
    widthM: 1.6,
    depthM: 1.0,
  },
  {
    tag: "EWS-MCT-11",
    room: "MCT-B01-187",
    xM: 10.1,
    yM: 3.6,
    widthM: 1.0,
    depthM: 1.0,
  },
  // The two wall devices, drawn as symbols.
  {
    tag: "RPM-MCT-11",
    room: "MCT-B01-187",
    xM: 9.8,
    yM: 5.0,
    widthM: SYMBOL_M,
    depthM: SYMBOL_M,
    symbol: true,
  },
  {
    tag: "ALI-MCT-11",
    room: "MCT-B01-187",
    xM: 10.6,
    yM: 6.4,
    widthM: SYMBOL_M,
    depthM: SYMBOL_M,
    symbol: true,
  },
];

/** A rectangle in metres as fractions of the drawing, which is how it is stored. */
export function toFraction(rect: RectM) {
  return {
    x: (rect.xM - ORIGIN_XM) / PLAN.widthM,
    y: rect.yM / PLAN.heightM,
    width: rect.widthM / PLAN.widthM,
    height: rect.depthM / PLAN.heightM,
  };
}

/** A rectangle in metres in the drawing's pixels, which is how it is drawn. */
export function toPx(rect: RectM) {
  return {
    x: (rect.xM - ORIGIN_XM) * PX_PER_M,
    y: rect.yM * PX_PER_M,
    width: rect.widthM * PX_PER_M,
    height: rect.depthM * PX_PER_M,
  };
}
