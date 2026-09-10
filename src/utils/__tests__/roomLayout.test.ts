import { describe, expect, it } from 'vitest';
import { DEFAULT_SHELF_CONFIG } from '@/utils/shelfLayout';
import {
  caseOuterDepth,
  caseOuterWidth,
  planLibrary,
  requiredDepth,
  viewingDistance,
  type Footprint,
} from '@/utils/roomLayout';

const overlaps = (a: Footprint, b: Footprint) =>
  Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
  Math.abs(a.z - b.z) < a.halfDepth + b.halfDepth;

describe('planLibrary', () => {
  it('always produces at least one bookcase', () => {
    expect(planLibrary(0).cases).toHaveLength(1);
  });

  it('places every case it is asked for', () => {
    for (const count of [1, 4, 5, 10, 17, 40]) {
      expect(planLibrary(count).cases).toHaveLength(count);
    }
  });

  it('fills the back wall before the side walls', () => {
    const plan = planLibrary(4);
    const backZ = plan.cases[0]!.position[2];
    expect(plan.cases.every((item) => item.position[2] === backZ)).toBe(true);
    expect(plan.cases.every((item) => item.rotation[1] === 0)).toBe(true);
  });

  it('turns side-wall cases to face into the room', () => {
    const plan = planLibrary(6);
    const turned = plan.cases.filter((item) => item.rotation[1] !== 0);
    expect(turned.length).toBe(2);
    expect(turned.map((item) => item.rotation[1]).sort()).toEqual(
      [-Math.PI / 2, Math.PI / 2].sort(),
    );
    // Left-wall case sits at negative x, right-wall case at positive x.
    expect(turned.some((item) => item.position[0] < 0)).toBe(true);
    expect(turned.some((item) => item.position[0] > 0)).toBe(true);
  });

  it('keeps the room at its base depth until the walls are full', () => {
    expect(requiredDepth(1)).toBe(9);
    expect(requiredDepth(10)).toBe(9);
    expect(requiredDepth(24)).toBeGreaterThan(9);
  });

  it('deepens the room rather than overlapping cases', () => {
    const plan = planLibrary(30);
    for (let i = 0; i < plan.cases.length; i += 1) {
      for (let j = i + 1; j < plan.cases.length; j += 1) {
        expect(overlaps(plan.cases[i]!.footprint, plan.cases[j]!.footprint)).toBe(false);
      }
    }
  });

  it('keeps every case inside the room', () => {
    const plan = planLibrary(30);
    const halfW = plan.room.width / 2;
    const halfD = plan.room.depth / 2;
    for (const item of plan.cases) {
      expect(Math.abs(item.position[0]) + item.footprint.halfWidth).toBeLessThanOrEqual(halfW);
      expect(Math.abs(item.position[2]) + item.footprint.halfDepth).toBeLessThanOrEqual(halfD);
    }
  });

  it('never stands furniture inside a bookcase', () => {
    const plan = planLibrary(12);
    const furniture = [plan.desk, plan.chair, plan.suggestionBox, ...plan.plants];
    for (const item of furniture) {
      for (const bookcase of plan.cases) {
        expect(overlaps(item.footprint, bookcase.footprint)).toBe(false);
      }
    }
  });

  it('derives case footprints from the shelf config', () => {
    expect(caseOuterWidth(DEFAULT_SHELF_CONFIG)).toBeCloseTo(1.68);
    expect(caseOuterDepth(DEFAULT_SHELF_CONFIG)).toBeCloseTo(0.31);
  });
});

describe('viewingDistance', () => {
  /** What the camera actually takes in across, at a given distance. */
  const framed = (distance: number, fov: number, aspect: number) =>
    2 * distance * Math.tan(Math.atan(Math.tan((fov * Math.PI) / 360) * aspect));

  it('stands back far enough to frame the width asked for', () => {
    for (const [fov, aspect] of [
      [62, 16 / 9],
      [78, 390 / 844],
      [69, 768 / 1024],
    ]) {
      expect(framed(viewingDistance(3.2, fov, aspect), fov, aspect)).toBeCloseTo(3.2, 6);
    }
  });

  it('sends a phone held upright more than twice as far back as a laptop', () => {
    const laptop = viewingDistance(3.2, 62, 16 / 9);
    const phone = viewingDistance(3.2, 78, 390 / 844);
    expect(phone).toBeGreaterThan(laptop * 2);
  });

  it('does not divide by a zero aspect', () => {
    expect(Number.isFinite(viewingDistance(3.2, 62, 0))).toBe(true);
  });
});
