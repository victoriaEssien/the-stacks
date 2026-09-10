import { useEffect, useState } from 'react';

/**
 * Honours `prefers-reduced-motion`. The stylesheet covers DOM transitions; the
 * 3D layer has to check this itself, so easing and drift can be skipped for
 * readers who asked for less movement.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
};
