import { describe, expect, it } from 'vitest';
import { BOOK_SIZE_LIMITS } from '../bookDimensions';
import {
  eyeHeightFor,
  KNEELING_EYE_HEIGHT,
  KNEELING_PACE,
  paceFor,
  STANDING_EYE_HEIGHT,
  stepPosture,
} from '../posture';
import { CASE_PANEL, caseOuterDepth } from '../roomLayout';
import { DEFAULT_SHELF_CONFIG, shelfSurfaceY } from '../shelfLayout';

describe('what kneeling buys at the bottom shelf', () => {
  /** The collision radius both camera schemes default to. */
  const PLAYER_RADIUS = 0.34;
  const config = DEFAULT_SHELF_CONFIG;

  /**
   * From the eye to the face of a cover on the shelf, as close as collision
   * lets the reader stand: the case's footprint plus their radius, less how far
   * the cover sits in front of the case's centre line.
   */
  const closest =
    caseOuterDepth(config) / 2 + PLAYER_RADIUS - (config.shelfDepth / 2 - config.frontInset);

  const floor = shelfSurfaceY(0, config);
  const typical =
    ((BOOK_SIZE_LIMITS.width.min + BOOK_SIZE_LIMITS.width.max) / 2) *
    ((BOOK_SIZE_LIMITS.aspect.min + BOOK_SIZE_LIMITS.aspect.max) / 2);
  const tallest = BOOK_SIZE_LIMITS.width.max * BOOK_SIZE_LIMITS.aspect.max;

  const degreesBelow = (eye: number, y: number) => (Math.atan2(eye - y, closest) * 180) / Math.PI;

  /**
   * The highest point of a bottom-shelf cover the eye can see past the front
   * edge of the board above it, which stands `frontInset` proud of the covers.
   */
  const highestVisible = (eye: number) => {
    const underside = shelfSurfaceY(1, config) - CASE_PANEL;
    return eye - ((eye - underside) * closest) / (closest - config.frontInset);
  };

  it('turns a look straight down at a sliver into one at a cover', () => {
    const middle = floor + typical / 2;
    expect(degreesBelow(STANDING_EYE_HEIGHT, middle)).toBeGreaterThan(70);
    expect(degreesBelow(KNEELING_EYE_HEIGHT, middle)).toBeLessThan(50);
  });

  it('gets under the board that hides the top of a cover from someone standing', () => {
    expect(highestVisible(STANDING_EYE_HEIGHT)).toBeLessThan(floor + typical);
    expect(highestVisible(KNEELING_EYE_HEIGHT)).toBeGreaterThan(floor + typical);
    // Even the tallest book a shelf can hold loses no more than a sliver.
    expect(highestVisible(KNEELING_EYE_HEIGHT) - floor).toBeGreaterThan(tallest * 0.9);
  });
});

describe('stepPosture', () => {
  it('gets all the way down quickly, but not in a single cut', () => {
    let progress = 0;
    let frames = 0;
    while (progress < 1 && frames < 1000) {
      progress = stepPosture(progress, true, 1 / 60);
      frames += 1;
    }
    expect(progress).toBe(1);
    expect(frames / 60).toBeGreaterThan(0.2);
    expect(frames / 60).toBeLessThan(0.5);
  });

  it('lands exactly and stays there rather than creeping', () => {
    expect(stepPosture(0.99, true, 0.1)).toBe(1);
    expect(stepPosture(1, true, 0.1)).toBe(1);
    expect(stepPosture(0.01, false, 0.1)).toBe(0);
    expect(stepPosture(0, false, 0.1)).toBe(0);
  });

  it('turns round when the reader changes their mind halfway down', () => {
    expect(stepPosture(0.5, false, 0.05)).toBeLessThan(0.5);
    expect(stepPosture(0.5, true, 0.05)).toBeGreaterThan(0.5);
  });

  it('covers the same ground whatever the frame rate', () => {
    const twoShort = stepPosture(stepPosture(0, true, 1 / 60), true, 1 / 60);
    expect(twoShort).toBeCloseTo(stepPosture(0, true, 1 / 30), 10);
  });

  it('cuts straight to the new height for someone who has asked for less motion', () => {
    expect(stepPosture(0, true, 1 / 60, true)).toBe(1);
    expect(stepPosture(1, false, 1 / 60, true)).toBe(0);
  });
});

describe('eyeHeightFor', () => {
  it('runs from standing to kneeling', () => {
    expect(eyeHeightFor(0)).toBe(STANDING_EYE_HEIGHT);
    expect(eyeHeightFor(1)).toBeCloseTo(KNEELING_EYE_HEIGHT, 10);
  });

  it('kneels to the same height whatever height the reader stands at', () => {
    expect(eyeHeightFor(0, 1.75)).toBe(1.75);
    expect(eyeHeightFor(1, 1.75)).toBeCloseTo(KNEELING_EYE_HEIGHT, 10);
  });

  it('eases in and out, so the head does not lurch at either end', () => {
    const drop = STANDING_EYE_HEIGHT - KNEELING_EYE_HEIGHT;
    expect(STANDING_EYE_HEIGHT - eyeHeightFor(0.05)).toBeLessThan(drop * 0.02);
    expect(eyeHeightFor(0.95) - KNEELING_EYE_HEIGHT).toBeLessThan(drop * 0.02);
  });

  it('only ever goes down on the way down', () => {
    for (let step = 0; step < 20; step += 1) {
      expect(eyeHeightFor((step + 1) / 20)).toBeLessThan(eyeHeightFor(step / 20));
    }
  });
});

describe('paceFor', () => {
  it('walks at full pace standing and slows on the knees', () => {
    expect(paceFor(0)).toBe(1);
    expect(paceFor(1)).toBeCloseTo(KNEELING_PACE, 10);
  });
});
