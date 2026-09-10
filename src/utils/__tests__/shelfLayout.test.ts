import { describe, expect, it } from 'vitest';
import { DEFAULT_SHELF_CONFIG, layOutBooks, shelfSurfaceY } from '../shelfLayout';

const makeBooks = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `book-${index}`, pageCount: 300 }));

describe('layOutBooks', () => {
  it('places every book exactly once', () => {
    const layout = layOutBooks(makeBooks(40));
    expect(layout.placements).toHaveLength(40);
    expect(Object.keys(layout.byId)).toHaveLength(40);
  });

  it('keeps books inside the shelf width', () => {
    const layout = layOutBooks(makeBooks(120));
    const half = DEFAULT_SHELF_CONFIG.shelfWidth / 2;
    for (const placement of layout.placements) {
      const edge = Math.abs(placement.position[0]) + placement.dimensions.width / 2;
      expect(edge).toBeLessThanOrEqual(half + 0.001);
    }
  });

  it('starts at the top shelf, so the first book is near eye level', () => {
    const [first] = layOutBooks(makeBooks(1)).placements;
    expect(first!.shelfIndex).toBe(DEFAULT_SHELF_CONFIG.shelvesPerCase - 1);
    expect(first!.position[1]).toBeGreaterThan(1.3);
  });

  it('fills downward, one shelf at a time', () => {
    const layout = layOutBooks(makeBooks(120));
    const order = layout.placements.filter((p) => p.caseIndex === 0).map((p) => p.shelfIndex);
    // Never climbs back up within a bookcase.
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]!).toBeLessThanOrEqual(order[i - 1]!);
    }
  });

  it('drops to the top shelf of the next bookcase once one is full', () => {
    const layout = layOutBooks(makeBooks(400));
    const secondCase = layout.placements.filter((p) => p.caseIndex === 1);
    expect(secondCase[0]!.shelfIndex).toBe(DEFAULT_SHELF_CONFIG.shelvesPerCase - 1);
  });

  it('wraps to a new shelf and then to a new bookcase', () => {
    const layout = layOutBooks(makeBooks(300));
    expect(layout.caseCount).toBeGreaterThan(1);
    expect(Math.max(...layout.placements.map((p) => p.shelfIndex))).toBeLessThan(
      DEFAULT_SHELF_CONFIG.shelvesPerCase,
    );
  });

  it('is deterministic', () => {
    const a = layOutBooks(makeBooks(25));
    const b = layOutBooks(makeBooks(25));
    expect(a.placements).toEqual(b.placements);
  });

  it('always reports at least one bookcase', () => {
    expect(layOutBooks([]).caseCount).toBe(1);
  });

  describe('cover-out display', () => {
    it('leans every book back against the shelf', () => {
      const layout = layOutBooks(makeBooks(6));
      for (const placement of layout.placements) {
        expect(placement.rotation[0]).toBeLessThan(0);
        expect(Math.abs(placement.rotation[0])).toBeLessThanOrEqual(DEFAULT_SHELF_CONFIG.maxTilt);
      }
    });

    it('keeps a leaning book resting on the shelf surface', () => {
      const layout = layOutBooks(makeBooks(3));
      const topShelf = DEFAULT_SHELF_CONFIG.shelvesPerCase - 1;
      for (const placement of layout.placements) {
        const { height, depth } = placement.dimensions;
        const lean = placement.rotation[0];
        // Lowest edge of the box once tilted, relative to its centre.
        const drop = (depth / 2) * Math.abs(Math.sin(lean)) + (height / 2) * Math.cos(lean);
        expect(placement.position[1] - drop).toBeCloseTo(
          shelfSurfaceY(topShelf, DEFAULT_SHELF_CONFIG),
          6,
        );
      }
    });

    it('gives each book a cover wider than its spine is thick', () => {
      for (const placement of layOutBooks(makeBooks(12)).placements) {
        expect(placement.dimensions.width).toBeGreaterThan(placement.dimensions.depth * 2);
        expect(placement.dimensions.height).toBeGreaterThan(placement.dimensions.width);
      }
    });

    it('fits far fewer books per shelf than spine-out would', () => {
      // One shelf of cover-out books is around ten, not forty.
      const perShelf = layOutBooks(makeBooks(60)).placements.filter(
        (p) => p.caseIndex === 0 && p.shelfIndex === DEFAULT_SHELF_CONFIG.shelvesPerCase - 1,
      ).length;
      expect(perShelf).toBeGreaterThan(6);
      expect(perShelf).toBeLessThan(14);
    });
  });
});
