import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { spineColorFromPixels } from '@/utils/color';
import { hashString } from '@/utils/hash';

/** URL -> spine colour. Sampling is done once per cover, ever. */
const cache = new Map<string, string>();
/** Big enough to be representative, small enough to be free. */
const SAMPLE = 24;

const sample = (image: CanvasImageSource, fallback: string): string | undefined => {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;

  try {
    context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    return spineColorFromPixels(context.getImageData(0, 0, SAMPLE, SAMPLE).data, fallback);
  } catch {
    // A cover served without CORS headers taints the canvas and getImageData
    // throws. Nothing to do but keep the hashed colour.
    return undefined;
  }
};

/**
 * The spine colour a book's cover implies, so a shelf looks like a row of real
 * books rather than a row of random swatches. Falls back to `fallback` while
 * the cover loads, when it cannot be read, or when it has no usable colour.
 */
export const useCoverColor = (texture: THREE.Texture | undefined, fallback: string): string => {
  const [color, setColor] = useState<string>();

  useEffect(() => {
    // A texture is handed to us before its image has decoded, so this runs
    // once with nothing to read.
    const image = texture?.image as (CanvasImageSource & { src?: string }) | undefined;
    if (!image) return;

    // Key on the whole source so two copies of one cover are sampled once.
    // Hashing rather than truncating matters: a generated cover is a data URL
    // whose first few hundred characters are an identical SVG preamble, so a
    // truncated key would collapse every generated cover onto one colour.
    const key = typeof image.src === 'string' ? String(hashString(image.src)) : texture?.uuid;
    if (!key) return;

    const cached = cache.get(key);
    if (cached) {
      setColor(cached);
      return;
    }

    const found = sample(image, fallback);
    if (!found) return;
    cache.set(key, found);
    setColor(found);
  }, [texture, fallback]);

  return color ?? fallback;
};
