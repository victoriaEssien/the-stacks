/**
 * The arithmetic behind touch navigation: telling a tap from a drag, turning a
 * pinch into a field of view, and deciding how far a swipe turns the head.
 *
 * Pure, so the fiddly parts of a gesture can be tested without a touchscreen -
 * everything in `TouchControls` that is worth asserting lives here.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * How far a finger may wander and still count as a tap. Generous: a thumb on
 * glass never lands still, and a tap misread as a drag turns the room instead
 * of opening the book that was under it.
 */
export const DRAG_SLOP_PX = 9;

/** A finger held longer than this was doing something, even if it never moved. */
export const TAP_MAX_MS = 600;

/** Straight up and straight down, less a hair, so the horizon cannot flip. */
export const MAX_PITCH = Math.PI / 2 - 0.02;

/** The room's field of view on a comfortable screen. Vertical, as three.js counts it. */
export const BASE_FOV = 62;

/**
 * How narrow a horizontal view the room may be seen through before the vertical
 * field of view is widened to compensate.
 */
const MIN_HORIZONTAL_FOV = 55;

/** Past this the perspective stretch at the edges starts to show. */
const MAX_VERTICAL_FOV = 78;

/** How far a pinch may lean in: a little over 2x. */
const MAX_PINCH = 0.45;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export const travelBetween = (from: Point2D, to: Point2D): number =>
  Math.hypot(to.x - from.x, to.y - from.y);

/** Whether a finished pointer sequence should open what was under the finger. */
export const isTap = (travel: number, elapsedMs: number): boolean =>
  travel <= DRAG_SLOP_PX && elapsedMs <= TAP_MAX_MS;

/**
 * Radians turned per pixel dragged, scaled so the gesture means the same thing
 * on a phone as on a tablet: a swipe right across the screen turns you about
 * 120 degrees, whatever the screen is.
 */
export const lookSensitivity = (viewportWidth: number): number =>
  (Math.PI * 2) / 3 / Math.max(1, viewportWidth);

/** The neck only goes so far. */
export const clampPitch = (pitch: number): number => clamp(pitch, -MAX_PITCH, MAX_PITCH);

const DEG = Math.PI / 180;

const horizontalFov = (verticalFov: number, aspect: number): number =>
  (2 * Math.atan(Math.tan((verticalFov * DEG) / 2) * aspect)) / DEG;

/**
 * The field of view the room rests at, for the screen it is actually being
 * looked at through.
 *
 * `fov` in three.js is VERTICAL, and a phone held upright is about half as wide
 * as it is tall - so the 62 degrees that gives a laptop a generous 94 degrees
 * across leaves a phone about 33, which is a view down a tube. Worse, at eye
 * height the nearest floor it can see is nearly three metres off, and the reader
 * walks by tapping the floor.
 *
 * So: widen vertically until the horizontal view is worth having, and stop
 * before the stretch at the edges becomes obvious.
 */
export const restingFov = (aspect: number, base = BASE_FOV): number => {
  if (aspect <= 0 || horizontalFov(base, aspect) >= MIN_HORIZONTAL_FOV) return base;
  const widened = (2 * Math.atan(Math.tan((MIN_HORIZONTAL_FOV * DEG) / 2) / aspect)) / DEG;
  return Math.min(widened, MAX_VERTICAL_FOV);
};

/**
 * Pinching apart narrows the field of view, which reads as leaning towards a
 * shelf to make out a spine. Moving the camera instead would push it through
 * the bookcase, so the lens does the work.
 *
 * Bounded by where the room rests rather than by fixed degrees: pinching back
 * returns you to the room's own view and no wider, whatever screen it is on.
 */
export const fovForPinch = (
  startFov: number,
  startSpan: number,
  span: number,
  resting: number,
): number => {
  const low = resting * MAX_PINCH;
  if (startSpan <= 0 || span <= 0) return clamp(startFov, low, resting);
  return clamp(startFov * (startSpan / span), low, resting);
};

/** The distance between the two fingers of a pinch. */
export const spanBetween = (points: Iterable<Point2D>): number => {
  const [first, second] = [...points];
  return first && second ? travelBetween(first, second) : 0;
};
