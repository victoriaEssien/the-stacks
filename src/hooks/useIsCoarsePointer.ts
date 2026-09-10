import { useEffect, useState } from 'react';

/**
 * True on touch-first devices, where WASD + pointer-lock navigation is not
 * practical. The app falls back to list mode there (spec section 16).
 */
export const useIsCoarsePointer = (): boolean => {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return coarse;
};
