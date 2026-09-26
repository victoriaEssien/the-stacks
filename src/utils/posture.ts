/**
 * How the reader holds themselves: standing to browse, or kneeling to read the
 * lower shelves.
 *
 * Pure, like the rest of the room's geometry, so what kneeling actually buys can
 * be tested against the real shelf layout rather than judged by eye. Both camera
 * schemes read it, so a reader on a phone and one on a laptop kneel to the same
 * height, at the same speed.
 */

/** Standing eye level, in metres. The top shelf's books sit just under it. */
export const STANDING_EYE_HEIGHT = 1.62;

/**
 * Down on your knees and bent towards a low shelf.
 *
 * The bottom shelf's books stand between 6 and 34 centimetres off the floor.
 * From as close as the reader can get to a bookcase, a standing eye meets the
 * middle of one about 75 degrees below the horizon, so the cover is a sliver and
 * the board above hides the top third of it. From here the same cover is under
 * 50 degrees down and nearly all of it is in view, and the shelf above it sits
 * straight ahead.
 */
export const KNEELING_EYE_HEIGHT = 0.6;

/**
 * How much slower the reader moves on their knees. Also what keeps a shelf a few
 * centimetres from the eye from streaking past.
 */
export const KNEELING_PACE = 0.5;

/** Standing to kneeling, or back, in seconds. */
const KNEEL_SECONDS = 0.35;

/**
 * One frame's step towards the posture the reader asked for. `progress` is 0
 * standing and 1 kneeling, and it moves at a steady rate, so changing your mind
 * halfway down simply turns you round rather than jumping.
 */
export const stepPosture = (
  progress: number,
  kneeling: boolean,
  delta: number,
  reducedMotion = false,
): number => {
  const target = kneeling ? 1 : 0;
  if (reducedMotion) return target;
  const step = delta / KNEEL_SECONDS;
  return target > progress ? Math.min(target, progress + step) : Math.max(target, progress - step);
};

/** Smoothstep: the head starts and stops gently instead of dropping like a lift. */
const eased = (progress: number): number => progress * progress * (3 - 2 * progress);

/** Where the eye is at a given point between standing and kneeling. */
export const eyeHeightFor = (progress: number, standing = STANDING_EYE_HEIGHT): number =>
  standing + (KNEELING_EYE_HEIGHT - standing) * eased(progress);

/** Walking speed as a fraction of a standing walk. */
export const paceFor = (progress: number): number => 1 + (KNEELING_PACE - 1) * eased(progress);
