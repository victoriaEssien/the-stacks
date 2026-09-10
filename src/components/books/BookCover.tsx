import { useCallback, useMemo, useState } from 'react';
import { generatedCover } from '@/utils/coverFallback';

export interface BookCoverProps {
  src?: string;
  title: string;
  author?: string;
  seed?: string;
  /** Sizes the cover. Put the aspect or the width/height here as before. */
  className?: string;
}

/**
 * Never renders a broken image: falls back to a generated cover.
 *
 * Covers are the one part of the library that is genuinely fetched over the
 * network every time it is looked at - the books themselves come out of local
 * storage in well under a millisecond - so this is where waiting is actually
 * visible, and where the skeleton goes. The wrapper is what carries the size,
 * so the placeholder occupies exactly the space the cover will, and nothing on
 * the page moves when it arrives.
 */
export const BookCover = ({ src, title, author = '', seed, className = '' }: BookCoverProps) => {
  const fallback = useMemo(
    () => generatedCover(title, author, seed ?? title),
    [title, author, seed],
  );

  // Adjusting state during render (rather than in an effect) is how React
  // recommends resetting state when a prop changes.
  const [tracked, setTracked] = useState({ src, failed: false, loaded: false });
  if (tracked.src !== src) setTracked({ src, failed: false, loaded: false });

  const resolved = !src || tracked.failed ? fallback : src;

  const markLoaded = useCallback(
    () => setTracked((prev) => (prev.loaded ? prev : { ...prev, loaded: true })),
    [],
  );

  /**
   * An image already in the browser cache can finish before React has attached
   * `onLoad`, and the cover would then sit at `opacity-0` permanently - an
   * invisible book. Ask the element itself on mount rather than only listening.
   */
  const measure = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) markLoaded();
    },
    [markLoaded],
  );

  return (
    <div
      className={`relative overflow-hidden rounded-sm shadow-lg shadow-black/40 ${
        tracked.loaded ? '' : 'skeleton'
      } ${className}`}
    >
      <img
        src={resolved}
        alt={`Cover of ${title}`}
        loading="lazy"
        decoding="async"
        ref={measure}
        onLoad={markLoaded}
        onError={() => setTracked({ src, failed: true, loaded: false })}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          tracked.loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
