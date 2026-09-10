/** Deterministic 32-bit string hash - same book always looks the same. */
export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Deterministic float in [0, 1) from a seed string + salt. */
export const seededUnit = (seed: string, salt = ''): number =>
  hashString(`${seed}::${salt}`) / 0xffffffff;

/** Deterministic float in [min, max). */
export const seededRange = (seed: string, salt: string, min: number, max: number): number =>
  min + seededUnit(seed, salt) * (max - min);
