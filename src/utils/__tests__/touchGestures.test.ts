import { describe, expect, it } from 'vitest';
import {
  BASE_FOV,
  clampPitch,
  DRAG_SLOP_PX,
  fovForPinch,
  isTap,
  lookSensitivity,
  MAX_PITCH,
  restingFov,
  spanBetween,
  travelBetween,
} from '../touchGestures';

/** Vertical fov to the horizontal one it actually shows, in degrees. */
const horizontal = (fov: number, aspect: number) =>
  (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) * 180) / Math.PI;

describe('isTap', () => {
  it('forgives the wobble of a thumb landing on glass', () => {
    expect(isTap(DRAG_SLOP_PX - 1, 120)).toBe(true);
  });

  it('rejects a finger that travelled', () => {
    expect(isTap(DRAG_SLOP_PX + 1, 120)).toBe(false);
  });

  it('rejects a finger held still for a long time', () => {
    expect(isTap(0, 5_000)).toBe(false);
  });
});

describe('lookSensitivity', () => {
  it('turns about 120 degrees for a swipe across the screen, whatever the width', () => {
    for (const width of [320, 390, 768, 1024]) {
      const turned = lookSensitivity(width) * width;
      expect(turned).toBeCloseTo((Math.PI * 2) / 3, 6);
    }
  });

  it('does not divide by a zero-width viewport', () => {
    expect(Number.isFinite(lookSensitivity(0))).toBe(true);
  });
});

describe('clampPitch', () => {
  it('stops short of straight up and straight down', () => {
    expect(clampPitch(Math.PI)).toBeCloseTo(MAX_PITCH, 6);
    expect(clampPitch(-Math.PI)).toBeCloseTo(-MAX_PITCH, 6);
  });

  it('leaves an ordinary glance alone', () => {
    expect(clampPitch(0.4)).toBe(0.4);
  });
});

describe('restingFov', () => {
  it('leaves a landscape screen at the field of view the room was built for', () => {
    expect(restingFov(16 / 9)).toBe(BASE_FOV);
    expect(restingFov(1)).toBe(BASE_FOV);
  });

  it('widens a portrait phone rather than showing the room down a tube', () => {
    const phone = restingFov(390 / 844);
    expect(phone).toBeGreaterThan(BASE_FOV);
    expect(horizontal(phone, 390 / 844)).toBeGreaterThan(horizontal(BASE_FOV, 390 / 844) + 8);
  });

  it('widens a portrait tablet only a little - it is not as narrow', () => {
    const tablet = restingFov(768 / 1024);
    const phone = restingFov(390 / 844);
    expect(tablet).toBeGreaterThan(BASE_FOV);
    expect(tablet).toBeLessThan(phone);
  });

  it('stops before the perspective stretch becomes obvious', () => {
    expect(restingFov(0.2)).toBeLessThanOrEqual(78);
  });

  it('does not divide by a zero aspect', () => {
    expect(restingFov(0)).toBe(BASE_FOV);
  });
});

describe('fovForPinch', () => {
  it('narrows the lens as the fingers spread', () => {
    expect(fovForPinch(62, 100, 200, 62)).toBeLessThan(62);
  });

  it('widens it as they close', () => {
    expect(fovForPinch(40, 200, 100, 62)).toBeGreaterThan(40);
  });

  it('never opens wider than where the room rests', () => {
    expect(fovForPinch(62, 10_000, 10, 62)).toBe(62);
    expect(fovForPinch(78, 10_000, 10, 78)).toBe(78);
  });

  it('leans in about twice, and no further', () => {
    expect(fovForPinch(62, 10, 10_000, 62)).toBeCloseTo(62 * 0.45, 6);
  });

  it('holds still when a span is missing, rather than dividing by zero', () => {
    expect(fovForPinch(62, 0, 120, 62)).toBe(62);
    expect(fovForPinch(62, 120, 0, 62)).toBe(62);
  });
});

describe('spanBetween', () => {
  it('measures the gap between two fingers', () => {
    expect(
      spanBetween([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(5);
  });

  it('is zero until there are two of them', () => {
    expect(spanBetween([{ x: 0, y: 0 }])).toBe(0);
    expect(spanBetween([])).toBe(0);
  });
});

describe('travelBetween', () => {
  it('is the straight-line distance', () => {
    expect(travelBetween({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
  });
});
