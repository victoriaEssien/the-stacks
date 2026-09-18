import { DEFAULT_SHELF_CONFIG, type ShelfConfig } from './shelfLayout';

/**
 * Where the furniture stands.
 *
 * Like `shelfLayout`, this is COMPUTED rather than hand-authored: the room is
 * derived from how many bookcases the collection needs, so the library
 * literally grows as books are added. Pure and deterministic - test it.
 */

export interface RoomDimensions {
  width: number;
  depth: number;
  height: number;
}

/** An axis-aligned floor footprint. Used for placement and for collision. */
export interface Footprint {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export interface Placement {
  position: [number, number, number];
  rotation: [number, number, number];
  footprint: Footprint;
}

export interface BookcasePlacement extends Placement {
  caseIndex: number;
}

export interface LibraryPlan {
  room: RoomDimensions;
  cases: BookcasePlacement[];
  desk: Placement;
  chair: Placement;
  suggestionBox: Placement;
  plants: Placement[];
  /** Everything the player should not be able to walk through. */
  obstacles: Footprint[];
}

/** Thickness of a bookcase's side panels. `Bookshelf` builds itself from this. */
export const CASE_PANEL = 0.04;

/**
 * How far back to stand to get `width` metres of wall into frame.
 *
 * three.js measures `fov` VERTICALLY, so how much of a room a camera sees
 * across depends entirely on the shape of the window: a laptop sees about 94
 * degrees, a phone held upright barely 40. The same stretch of shelf therefore
 * needs the reader standing more than twice as far off on a phone - and without
 * that, the library opens on a close-up of blank wall.
 */
export const viewingDistance = (width: number, fovDegrees: number, aspect: number): number => {
  const halfHorizontal = Math.atan(Math.tan((fovDegrees * Math.PI) / 360) * Math.max(aspect, 0.01));
  return width / 2 / Math.tan(halfHorizontal);
};

const ROOM_WIDTH = 9;
const BASE_DEPTH = 9;
const ROOM_HEIGHT = 3.4;

/** Case back to wall. */
const WALL_GAP = 0.06;
/** Between neighbouring cases in a run. */
const CASE_GAP = 0.22;
/** Keeps runs out of the corners, where two cases would fight for the space. */
const CORNER_INSET = 0.75;
/** Open floor kept at the front of the room for the desk and the entrance. */
const FRONT_CLEARANCE = 2.6;

export const caseOuterWidth = (config: ShelfConfig = DEFAULT_SHELF_CONFIG): number =>
  config.shelfWidth + CASE_PANEL * 2;

export const caseOuterDepth = (config: ShelfConfig = DEFAULT_SHELF_CONFIG): number =>
  config.shelfDepth + 0.03;

/** How many cases fit in a straight run of `length` metres. */
const runCapacity = (length: number, config: ShelfConfig): number => {
  const step = caseOuterWidth(config) + CASE_GAP;
  return Math.max(0, Math.floor((length + CASE_GAP) / step));
};

/** Centres for `count` cases packed from the start of a run of `length`. */
const runOffsets = (count: number, length: number, config: ShelfConfig): number[] => {
  const outer = caseOuterWidth(config);
  const step = outer + CASE_GAP;
  const used = count * outer + Math.max(0, count - 1) * CASE_GAP;
  // Centre the run within the space it has, so a half-full wall stays balanced.
  const start = (length - used) / 2 + outer / 2;
  return Array.from({ length: count }, (_, index) => start + index * step);
};

const backRunLength = () => ROOM_WIDTH - CORNER_INSET * 2;
const sideRunLength = (depth: number) => depth - CORNER_INSET - FRONT_CLEARANCE;

/**
 * How many bookcases the base room can stand against its walls.
 *
 * Computed, not chosen: the back wall takes what the room's width allows, and
 * each side wall takes what is left of its depth once the front clearance and
 * the corner inset are removed.
 */
export const baseRoomCapacity = (config: ShelfConfig = DEFAULT_SHELF_CONFIG): number =>
  runCapacity(backRunLength(), config) + 2 * runCapacity(sideRunLength(BASE_DEPTH), config);

/**
 * How many bookcases to actually build for a collection that needs `needed`.
 *
 * A library is a room LINED with shelves. It is not storage sized to its
 * current contents, so the walls are furnished whether or not there is anything
 * to put on them: one bookcase alone in a nine metre room reads as an empty
 * room with a bookcase in it, which is not the thing being built. Beyond what
 * the base room holds the old behaviour takes over and the room deepens.
 *
 * Kept out of `planLibrary` so that the planner keeps its exact contract - plan
 * the number of cases you are asked for - and this policy stays separately
 * testable. Callers compose the two.
 */
export const furnishedCaseCount = (
  needed: number,
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): number => Math.max(needed, baseRoomCapacity(config));

/**
 * Room depth needed to stand `caseCount` bookcases against the walls. The back
 * wall is fixed by the room's width, so any overflow lengthens the side walls.
 */
export const requiredDepth = (
  caseCount: number,
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): number => {
  const onBack = runCapacity(backRunLength(), config);
  const perSide = Math.ceil(Math.max(0, caseCount - onBack) / 2);
  if (perSide === 0) return BASE_DEPTH;

  const step = caseOuterWidth(config) + CASE_GAP;
  const needed = perSide * step - CASE_GAP + CORNER_INSET + FRONT_CLEARANCE;
  return Math.max(BASE_DEPTH, Number(needed.toFixed(3)));
};

/**
 * How much of the room the reader should be able to see on arrival: two
 * bookcases side by side, or the whole back wall when it is shorter than that.
 *
 * Two, specifically, because it is the narrowest frame that still reads as a
 * WALL of shelves rather than as one piece of furniture. Framing the entire
 * back run was tried and looks worse: it stands the reader far enough back that
 * the shelves occupy the top third of the screen and the rest is floor.
 */
export const framedWidth = (
  plan: LibraryPlan,
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): number => {
  const outer = caseOuterWidth(config);
  const backX = plan.cases.filter((item) => item.rotation[1] === 0).map((item) => item.position[0]);
  const backSpan = backX.length === 0 ? outer : Math.max(...backX) - Math.min(...backX) + outer;
  return Math.min(outer * 2 + CASE_GAP, backSpan);
};

/** Never closer than this, however narrow the framing works out. */
const MIN_STAND_OFF = 3.2;

/**
 * Where the reader stands when the library opens.
 *
 * Lined up with the first BOOK rather than the middle of its case, because
 * books pack from the left of a shelf and a small collection would otherwise
 * sit off to the side of wherever the camera looked.
 *
 * Both axes are clamped into the open floor. With the walls furnished the first
 * case is the left END of the back wall, not its middle, so following the books
 * that far would stand the reader in among the side-wall shelves. The clamp
 * keeps them out in the room where they can see it, and they can walk over.
 *
 * `fov` is VERTICAL in three.js, so how much of the wall fits across depends
 * entirely on the shape of the window - see `viewingDistance`. A phone held
 * upright therefore starts further back than a laptop, not closer.
 */
export const spawnPoint = (
  plan: LibraryPlan,
  fovDegrees: number,
  aspect: number,
  firstBookOffsetX = 0,
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): { x: number; z: number } => {
  const firstCase = plan.cases[0];
  const halfW = plan.room.width / 2;
  const halfD = plan.room.depth / 2;

  const standOff = Math.max(
    MIN_STAND_OFF,
    viewingDistance(framedWidth(plan, config), fovDegrees, aspect),
  );

  // Clear of the inner face of a side-wall run, with room to turn around.
  const limitX = Math.max(0, halfW - caseOuterDepth(config) - WALL_GAP - 2.0);
  const wanted = (firstCase?.position[0] ?? 0) + firstBookOffsetX;

  return {
    x: Math.min(limitX, Math.max(-limitX, wanted)),
    z: Math.min(halfD - 1, (firstCase?.position[2] ?? 0) + standOff),
  };
};

const footprintFor = (
  x: number,
  z: number,
  width: number,
  depth: number,
  quarterTurns: boolean,
): Footprint => ({
  x,
  z,
  halfWidth: (quarterTurns ? depth : width) / 2,
  halfDepth: (quarterTurns ? width : depth) / 2,
});

/**
 * Plan the whole room for a given number of bookcases.
 *
 * Cases fill the back wall first, then the left and right walls front-to-back.
 * The room deepens when the walls run out, so the layout never overlaps itself
 * and never spills outside the room.
 */
export const planLibrary = (
  caseCount: number,
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): LibraryPlan => {
  const total = Math.max(1, caseCount);
  const depth = requiredDepth(total, config);
  const room: RoomDimensions = { width: ROOM_WIDTH, depth, height: ROOM_HEIGHT };

  const outerW = caseOuterWidth(config);
  const outerD = caseOuterDepth(config);
  const halfW = room.width / 2;
  const halfD = room.depth / 2;

  const onBack = Math.min(total, runCapacity(backRunLength(), config));
  const remaining = total - onBack;
  const onLeft = Math.ceil(remaining / 2);
  const onRight = remaining - onLeft;

  const cases: BookcasePlacement[] = [];
  const push = (position: [number, number, number], ry: number, quarter: boolean) => {
    cases.push({
      caseIndex: cases.length,
      position,
      rotation: [0, ry, 0],
      footprint: footprintFor(position[0], position[2], outerW, outerD, quarter),
    });
  };

  // Back wall: the case's own front faces +z, which is the default orientation.
  const backZ = -halfD + outerD / 2 + WALL_GAP;
  for (const offset of runOffsets(onBack, backRunLength(), config)) {
    push([-halfW + CORNER_INSET + offset, 0, backZ], 0, false);
  }

  // Side walls: a quarter turn points each run's fronts into the room.
  const sideLength = sideRunLength(room.depth);
  const sideZ = (offset: number) => -halfD + CORNER_INSET + offset;

  for (const offset of runOffsets(onLeft, sideLength, config)) {
    push([-halfW + outerD / 2 + WALL_GAP, 0, sideZ(offset)], Math.PI / 2, true);
  }
  for (const offset of runOffsets(onRight, sideLength, config)) {
    push([halfW - outerD / 2 - WALL_GAP, 0, sideZ(offset)], -Math.PI / 2, true);
  }

  // Furniture sits near the front of the room, so it stays put as the room
  // deepens behind it.
  const deskZ = halfD - 1.9;
  const desk: Placement = {
    position: [0.35, 0, deskZ],
    rotation: [0, -0.22, 0],
    footprint: { x: 0.35, z: deskZ, halfWidth: 0.82, halfDepth: 0.42 },
  };
  const chair: Placement = {
    position: [0.28, 0, deskZ + 0.95],
    rotation: [0, Math.PI - 0.18, 0],
    footprint: { x: 0.28, z: deskZ + 0.95, halfWidth: 0.3, halfDepth: 0.3 },
  };
  const suggestionBox: Placement = {
    position: [-2.75, 0, halfD - 2.3],
    rotation: [0, 0.5, 0],
    footprint: { x: -2.75, z: halfD - 2.3, halfWidth: 0.22, halfDepth: 0.22 },
  };
  const plants: Placement[] = [
    {
      position: [halfW - 0.85, 0, halfD - 0.95],
      rotation: [0, 0.4, 0],
      footprint: { x: halfW - 0.85, z: halfD - 0.95, halfWidth: 0.3, halfDepth: 0.3 },
    },
    {
      position: [-halfW + 0.9, 0, halfD - 1.1],
      rotation: [0, -0.7, 0],
      footprint: { x: -halfW + 0.9, z: halfD - 1.1, halfWidth: 0.26, halfDepth: 0.26 },
    },
  ];

  return {
    room,
    cases,
    desk,
    chair,
    suggestionBox,
    plants,
    obstacles: [
      ...cases.map((item) => item.footprint),
      desk.footprint,
      chair.footprint,
      suggestionBox.footprint,
      ...plants.map((item) => item.footprint),
    ],
  };
};
