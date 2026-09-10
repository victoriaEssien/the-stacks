/**
 * Colour helpers for deriving a book's spine from its cover art.
 *
 * The pixel maths lives here, away from any canvas, so it can be tested
 * directly. `three/materials/useCoverColor` does the drawing and calls in.
 */

export interface Hsl {
  /** 0-1 */
  h: number;
  /** 0-1 */
  s: number;
  /** 0-1 */
  l: number;
}

export const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6;
  else h = ((rn - gn) / delta + 4) / 6;

  return { h, s, l };
};

const hueToChannel = (p: number, q: number, t: number): number => {
  const shifted = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (shifted < 1 / 6) return p + (q - p) * 6 * shifted;
  if (shifted < 1 / 2) return q;
  if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6;
  return p;
};

export const hslToHex = ({ h, s, l }: Hsl): string => {
  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToChannel(p, q, h + 1 / 3);
    g = hueToChannel(p, q, h);
    b = hueToChannel(p, q, h - 1 / 3);
  }

  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

/** Spines are cloth or board, never a bright printed cover. */
const SPINE_LIGHTNESS = { min: 0.16, max: 0.4 } as const;
const SPINE_MAX_SATURATION = 0.55;

/**
 * Pull a spine colour out of a cover's pixels.
 *
 * Paper white, print black and washed-out greys are skipped - they are the
 * background of most covers and would make every book on the shelf the same
 * dull grey. The winning hue is then pushed into a narrow, deep lightness band
 * so the shelf reads as bound books and the spine lettering stays legible.
 */
export const spineColorFromPixels = (
  pixels: Uint8ClampedArray | number[],
  fallback: string,
): string => {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  const consider = (minSaturation: number) => {
    buckets.clear();
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      const a = pixels[i + 3] ?? 0;
      if (a < 128) continue;

      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const { s, l } = rgbToHsl(r, g, b);
      if (l > 0.9 || l < 0.06 || s < minSaturation) continue;

      // 5 bits of colour is plenty to group "the same" shade together.
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  };

  // Prefer a coloured shade; fall back to any shade for greyscale covers.
  consider(0.15);
  if (buckets.size === 0) consider(0);
  if (buckets.size === 0) return fallback;

  let winner = { count: 0, r: 0, g: 0, b: 0 };
  for (const bucket of buckets.values()) {
    if (bucket.count > winner.count) winner = bucket;
  }

  const { h, s } = rgbToHsl(
    winner.r / winner.count,
    winner.g / winner.count,
    winner.b / winner.count,
  );

  return hslToHex({
    h,
    s: Math.min(s, SPINE_MAX_SATURATION),
    l: Math.min(SPINE_LIGHTNESS.max, Math.max(SPINE_LIGHTNESS.min, 0.28)),
  });
};
