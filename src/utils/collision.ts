import type { Footprint } from './roomLayout';

/**
 * Keeps the player out of the furniture.
 *
 * The player is a circle, obstacles are axis-aligned boxes, and movement is
 * resolved one axis at a time: try the x step, then the z step, dropping either
 * if it would end inside something. That is the standard character-controller
 * trick - it slides along a bookcase instead of sticking to it, and it cannot
 * oscillate the way push-out resolution does in a gap too narrow to stand in.
 *
 * Pure, so it can be tested without a canvas.
 */

export interface Position2D {
  x: number;
  z: number;
}

const insideBox = (position: Position2D, box: Footprint, radius: number): boolean =>
  Math.abs(position.x - box.x) < box.halfWidth + radius &&
  Math.abs(position.z - box.z) < box.halfDepth + radius;

/** True when the circle overlaps any obstacle. */
export const isBlocked = (
  position: Position2D,
  obstacles: readonly Footprint[],
  radius: number,
): boolean => obstacles.some((box) => insideBox(position, box, radius));

/**
 * Move from `from` towards `to`, stopping against obstacles. A player who has
 * somehow ended up inside geometry - the room grows a bookcase around them, say
 * - is allowed to move freely rather than being trapped.
 */
export const moveWithCollisions = (
  from: Position2D,
  to: Position2D,
  obstacles: readonly Footprint[],
  radius: number,
): Position2D => {
  if (obstacles.length === 0 || isBlocked(from, obstacles, radius)) return to;

  let { x, z } = from;
  if (!isBlocked({ x: to.x, z }, obstacles, radius)) x = to.x;
  if (!isBlocked({ x, z: to.z }, obstacles, radius)) z = to.z;
  return { x, z };
};

/** Keep the player inside the four walls. */
export const clampToRoom = (
  position: Position2D,
  room: { width: number; depth: number },
  radius: number,
): Position2D => ({
  x: Math.min(room.width / 2 - radius, Math.max(-room.width / 2 + radius, position.x)),
  z: Math.min(room.depth / 2 - radius, Math.max(-room.depth / 2 + radius, position.z)),
});
