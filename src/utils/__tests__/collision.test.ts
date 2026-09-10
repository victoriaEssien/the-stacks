import { describe, expect, it } from 'vitest';
import { clampToRoom, isBlocked, moveWithCollisions } from '@/utils/collision';
import type { Footprint } from '@/utils/roomLayout';

const box: Footprint = { x: 0, z: 0, halfWidth: 1, halfDepth: 0.5 };
const RADIUS = 0.35;

describe('moveWithCollisions', () => {
  it('allows a move that touches nothing', () => {
    const to = { x: 3, z: 3 };
    expect(moveWithCollisions({ x: 2.5, z: 3 }, to, [box], RADIUS)).toEqual(to);
  });

  it('stops a walk straight into an obstacle', () => {
    const from = { x: 0, z: 2 };
    const resolved = moveWithCollisions(from, { x: 0, z: 0.5 }, [box], RADIUS);
    expect(resolved.z).toBe(2);
  });

  it('slides along a face instead of sticking to it', () => {
    // Walking diagonally into the front of the box: x is free, z is blocked.
    const from = { x: -0.5, z: 1 };
    const resolved = moveWithCollisions(from, { x: 0.2, z: 0.6 }, [box], RADIUS);
    expect(resolved.x).toBeCloseTo(0.2);
    expect(resolved.z).toBe(1);
  });

  it('refuses to squeeze through a gap narrower than the player', () => {
    const boxes: Footprint[] = [
      { x: -0.6, z: 0, halfWidth: 0.5, halfDepth: 0.5 },
      { x: 0.6, z: 0, halfWidth: 0.5, halfDepth: 0.5 },
    ];
    const resolved = moveWithCollisions({ x: 0, z: 1.5 }, { x: 0, z: 0.6 }, boxes, 0.35);
    expect(resolved.z).toBe(1.5);
  });

  it('lets a player who is already inside geometry walk back out', () => {
    const to = { x: 2, z: 0 };
    expect(moveWithCollisions({ x: 0, z: 0 }, to, [box], RADIUS)).toEqual(to);
  });

  it('is a no-op when there is nothing to hit', () => {
    const to = { x: 1, z: 1 };
    expect(moveWithCollisions({ x: 0, z: 0 }, to, [], RADIUS)).toEqual(to);
  });
});

describe('isBlocked', () => {
  it('accounts for the player radius', () => {
    expect(isBlocked({ x: 1.2, z: 0 }, [box], 0.1)).toBe(false);
    expect(isBlocked({ x: 1.2, z: 0 }, [box], 0.35)).toBe(true);
  });
});

describe('clampToRoom', () => {
  it('keeps the player inside the walls', () => {
    const room = { width: 9, depth: 9 };
    expect(clampToRoom({ x: 99, z: -99 }, room, 0.4)).toEqual({ x: 4.1, z: -4.1 });
  });
});
