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
