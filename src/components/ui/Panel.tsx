import type { ReactNode } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useIsCoarsePointer } from '@/hooks/useIsCoarsePointer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';
import { Button } from './Button';
import { CloseIcon } from './icons';

/**
 * `side` slides in from the right, `center` is a modal card, and `screen` is a
 * tab destination - somewhere the reader went on purpose rather than something
 * that opened on top of them. On a pointer `screen` is just `center`; there are
 * no tabs there to have come from.
 */
export type PanelPlacement = 'side' | 'center' | 'screen';

export interface PanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  placement?: PanelPlacement;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * The 2D overlay shell. It floats ON TOP of the 3D scene rather than replacing
 * it, so the reader never leaves the library (spec section 7).
 *
 * On touch it is a sheet: it comes up from the bottom edge, wears a grabber,
 * and can be thrown back down. A `screen` stops above the tab bar and keeps it
 * visible, because the bar is how the reader got here and how they leave.
 */
export const Panel = ({
  title,
  subtitle,
  onClose,
  placement = 'center',
  children,
  footer,
}: PanelProps) => {
  const compact = useIsCoarsePointer();
  const reducedMotion = useReducedMotion();
  useEscapeKey(true, onClose);

  // A destination is not thrown away, it is navigated out of - and it has no
  // bottom edge to throw it past, because the tab bar is sitting there.
  const dismissible = compact && placement !== 'screen';
  const { sheetRef, handleProps } = useSheetDismiss(onClose, dismissible, reducedMotion);

  const isScreen = compact && placement === 'screen';

  const container = isScreen
    ? 'items-stretch justify-center bg-ink-900 pb-tabbar'
    : placement === 'side'
      ? 'items-stretch justify-end bg-ink-900/55 backdrop-blur-[2px]'
      : 'items-end justify-center bg-ink-900/55 backdrop-blur-[2px] sm:items-center sm:p-8';

  const card = isScreen
    ? 'pt-safe h-full w-full border-0'
    : placement === 'side'
      ? 'inset-safe h-full w-full max-w-md rounded-none sm:rounded-l-panel'
      : 'pb-safe max-h-[88dvh] w-full rounded-t-panel sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-panel';

  return (
    <div
      className={`pointer-events-auto fixed inset-0 flex ${isScreen ? 'z-20' : 'z-40'} ${container}`}
      role="presentation"
      onClick={(event) => {
        if (!isScreen && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal={isScreen ? undefined : true}
        aria-label={title}
        className={`flex flex-col overflow-hidden border border-ink-500/70 bg-ink-800/95 shadow-2xl shadow-black/60 ${card}`}
      >
        <div {...(dismissible ? handleProps : {})} className={dismissible ? 'touch-none' : ''}>
          {dismissible && (
            <div className="flex justify-center pb-1 pt-2.5">
              <span className="h-1 w-9 rounded-full bg-ink-500" />
            </div>
          )}

          <header className="flex items-start justify-between gap-4 border-b border-ink-600 px-5 py-4">
            <div>
              <h2 className="font-serif text-xl text-parchment">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-parchment-dim">{subtitle}</p>}
            </div>
            <Button variant="quiet" aria-label="Close" onClick={onClose} className="-mr-2 -mt-1">
              <CloseIcon className="h-4.5 w-4.5" />
            </Button>
          </header>
        </div>

        <div className="scroll-warm flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="border-t border-ink-600 px-5 py-3">{footer}</footer>}
      </section>
    </div>
  );
};
