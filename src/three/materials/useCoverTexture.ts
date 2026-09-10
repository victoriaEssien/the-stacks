import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { generatedCover } from '@/utils/coverFallback';

const loader = new THREE.TextureLoader();
/** URL -> texture. Two copies of the same book share one GPU texture. */
const cache = new Map<string, THREE.Texture>();
/** URLs that have already refused to load. Asking twice never helps. */
const rejected = new Set<string>();

const load = (url: string): Promise<THREE.Texture> =>
  new Promise((resolve, reject) => {
    const cached = cache.get(url);
    if (cached) {
      resolve(cached);
      return;
    }
    if (rejected.has(url)) {
      reject(new Error('previously failed'));
      return;
    }
    // WebGL will only sample a CORS-clean image. Anything served without
    // `Access-Control-Allow-Origin` fails here rather than merely losing its
    // sampled spine colour - see `isTextureSafeCover` in the books service.
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        cache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (cause) => {
        rejected.add(url);
        reject(cause instanceof Error ? cause : new Error('texture failed'));
      },
    );
  });

/**
 * Loads a cover texture, trying each candidate in turn and falling back to a
 * generated one - a book is never rendered with a broken image.
 *
 * Candidates rather than a single URL because the best-looking cover and the
 * only cover WebGL will accept are often not the same file; the books service
 * decides the order.
 */
export const useCoverTexture = (
  candidates: readonly string[],
  title: string,
  author: string,
  seed: string,
): THREE.Texture | undefined => {
  const [texture, setTexture] = useState<THREE.Texture>();

  // Depend on the contents, not the array: callers build a fresh one each
  // render and re-running this per frame would be absurd.
  const key = candidates.join('|');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      for (const url of key ? key.split('|') : []) {
        try {
          const result = await load(url);
          if (cancelled) return;
          setTexture(result);
          return;
        } catch {
          // Try the next one.
        }
      }

      try {
        const result = await load(generatedCover(title, author, seed));
        if (!cancelled) setTexture(result);
      } catch {
        if (!cancelled) setTexture(undefined);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [key, title, author, seed]);

  return texture;
};
