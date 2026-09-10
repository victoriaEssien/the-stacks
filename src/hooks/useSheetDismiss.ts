import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

/** Past this much of its own height, letting go dismisses the sheet. */
const DISMISS_FRACTION = 0.22;
/** ...but never asking for more than this, however tall the sheet is. */
const DISMISS_CEILING_PX = 130;
/** A flick counts even if it never travelled far. Pixels per millisecond. */
const FLICK_VELOCITY = 0.55;

const EASE = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';

export interface SheetDismiss {
  /** Put on the sheet itself - this is what moves. */
  sheetRef: React.RefObject<HTMLElement | null>;
  /** Spread onto the grab area. Deliberately NOT the whole sheet: a drag that
   *  started over the content should scroll it, not close it. */
  handleProps: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerMove: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
    onPointerCancel: (event: ReactPointerEvent) => void;
  };
}

/**
 * Drag a sheet down to dismiss it, the way every mobile app does.
 *
 * The offset is written straight to the element's transform rather than held in
 * state: it changes with every frame of the drag, and re-rendering a panel full
 * of form fields sixty times a second to move it would be absurd.
 */
export const useSheetDismiss = (
  onClose: () => void,
  enabled: boolean,
  reducedMotion = false,
): SheetDismiss => {
  const sheetRef = useRef<HTMLElement | null>(null);
  const start = useRef<{ y: number; at: number } | null>(null);
  const offset = useRef(0);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!enabled || !sheetRef.current) return;
      start.current = { y: event.clientY, at: performance.now() };
      offset.current = 0;
      sheetRef.current.style.transition = 'none';
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    const from = start.current;
    const sheet = sheetRef.current;
    if (!from || !sheet) return;
    // Downward only. Dragging up should not lift the sheet off its own edge.
    offset.current = Math.max(0, event.clientY - from.y);
    sheet.style.transform = `translateY(${offset.current}px)`;
  }, []);

  const settle = useCallback(
    (event: ReactPointerEvent) => {
      const from = start.current;
      const sheet = sheetRef.current;
      start.current = null;
      if (!from || !sheet) return;

      const elapsed = Math.max(1, performance.now() - from.at);
      const flicked = offset.current / elapsed > FLICK_VELOCITY;
      const threshold = Math.min(DISMISS_CEILING_PX, sheet.offsetHeight * DISMISS_FRACTION);

      if (event.type === 'pointercancel' || (!flicked && offset.current < threshold)) {
        sheet.style.transition = reducedMotion ? 'none' : EASE;
        sheet.style.transform = '';
        return;
      }

      if (reducedMotion) {
        onClose();
        return;
      }
      sheet.style.transition = EASE;
      sheet.style.transform = 'translateY(100%)';
      // Let it get out of the way before the panel stops existing.
      setTimeout(onClose, 190);
    },
    [onClose, reducedMotion],
  );

  return {
    sheetRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: settle,
      onPointerCancel: settle,
    },
  };
};
