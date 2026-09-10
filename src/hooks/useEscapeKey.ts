import { useEffect } from 'react';

/**
 * Calls `onEscape` while `active`. Every overlay uses this to stay closable.
 *
 * One exception: while the 3D room holds the mouse, Escape is how the reader
 * gets their cursor back, and closing their half-filled form at the same time
 * would be a small disaster.
 */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.pointerLockElement) return;
      onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onEscape]);
};
