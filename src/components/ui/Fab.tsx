import type { ReactNode } from 'react';

export interface FabProps {
  /** What it does, for anyone who cannot see the glyph. */
  label: string;
  onClick: () => void;
  children: ReactNode;
}

/**
 * The one create action, floating clear of the tab bar.
 *
 * Adding a book is not a place you go, so it does not belong in a row of
 * places. Giving it a slot in the bar also cost the bar a quarter of its width
 * and left the reader guessing which of the four things was the important one.
 */
export const Fab = ({ label, onClick, children }: FabProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brass text-ink-900 shadow-lg shadow-black/50 transition-transform active:scale-95"
  >
    {children}
  </button>
);
