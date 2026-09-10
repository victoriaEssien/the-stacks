import { describe, expect, it } from 'vitest';
import { hslToHex, rgbToHsl, spineColorFromPixels } from '@/utils/color';

/** Build a flat pixel buffer from [r,g,b] triples. */
const pixels = (colors: [number, number, number][], alpha = 255) =>
  Uint8ClampedArray.from(colors.flatMap(([r, g, b]) => [r, g, b, alpha]));

const FALLBACK = '#7a3b32';

describe('rgbToHsl / hslToHex', () => {
  it('round-trips a saturated colour', () => {
    const hsl = rgbToHsl(200, 40, 40);
    expect(hslToHex(hsl)).toBe('#c82828');
  });

  it('reports greys as unsaturated', () => {
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });
});

describe('spineColorFromPixels', () => {
  it('falls back when there is nothing to sample', () => {
    expect(spineColorFromPixels(new Uint8ClampedArray(), FALLBACK)).toBe(FALLBACK);
  });

  it('ignores paper white and print black', () => {
    const white: [number, number, number] = [255, 255, 255];
    const black: [number, number, number] = [2, 2, 2];
    const teal: [number, number, number] = [20, 130, 130];
    const sample = pixels([white, white, white, black, black, teal]);
    // Teal is outnumbered 5:1 and still wins, because the rest is skipped.
    expect(rgbToHsl(...hexToRgb(spineColorFromPixels(sample, FALLBACK))).h).toBeCloseTo(
      rgbToHsl(...teal).h,
      1,
    );
  });

  it('keeps the hue but darkens it to a spine', () => {
    const bright: [number, number, number] = [90, 200, 90];
    const result = spineColorFromPixels(pixels([bright, bright, bright]), FALLBACK);
    const hsl = rgbToHsl(...hexToRgb(result));
    expect(hsl.h).toBeCloseTo(rgbToHsl(...bright).h, 1);
    expect(hsl.l).toBeLessThan(0.45);
    expect(hsl.l).toBeGreaterThan(0.14);
  });

  it('picks the most common shade, not the first', () => {
    const red: [number, number, number] = [190, 40, 40];
    const blue: [number, number, number] = [40, 60, 190];
    const sample = pixels([blue, red, red, red, red]);
    const hsl = rgbToHsl(...hexToRgb(spineColorFromPixels(sample, FALLBACK)));
    expect(hsl.h).toBeCloseTo(rgbToHsl(...red).h, 1);
  });

  it('still finds a colour on a greyscale cover', () => {
    const grey: [number, number, number] = [120, 120, 122];
    const result = spineColorFromPixels(pixels([grey, grey, grey]), FALLBACK);
    expect(result).not.toBe(FALLBACK);
    expect(rgbToHsl(...hexToRgb(result)).l).toBeLessThan(0.45);
  });

  it('skips transparent pixels', () => {
    expect(spineColorFromPixels(pixels([[190, 40, 40]], 0), FALLBACK)).toBe(FALLBACK);
  });
});

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
