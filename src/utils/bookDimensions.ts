import type { Book } from '@/models';
import { seededRange } from './hash';

/** Metres. The room is modelled at roughly 1 unit = 1 metre. */
export interface BookDimensions {
  /** Cover width - how much shelf the book eats, since books face outward. */
  width: number;
  /** Cover height. */
  height: number;
  /** Front-to-back thickness: the spine. */
  depth: number;
}

export const BOOK_SIZE_LIMITS = {
  width: { min: 0.125, max: 0.17 },
  /** Height as a multiple of width. Real books cluster around 3:2. */
  aspect: { min: 1.38, max: 1.62 },
  depth: { min: 0.02, max: 0.058 },
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Physical size for a book. Thickness follows the page count where it is known
 * and a stable hash of the id otherwise, so a book never changes size between
 * renders or reloads.
 *
 * Books stand cover-out on the shelves, so `width` is the cover, not the spine:
 * a book eats roughly five times the shelf a spine-out one would.
 */
export const bookDimensions = (book: Pick<Book, 'id' | 'pageCount'>): BookDimensions => {
  const { width, aspect, depth } = BOOK_SIZE_LIMITS;

  const coverWidth = seededRange(book.id, 'w', width.min, width.max);
  const pageDriven =
    typeof book.pageCount === 'number' && book.pageCount > 0
      ? clamp(book.pageCount / 8000, depth.min, depth.max)
      : undefined;

  return {
    width: coverWidth,
    height: coverWidth * seededRange(book.id, 'a', aspect.min, aspect.max),
    depth: pageDriven ?? seededRange(book.id, 'd', depth.min, depth.max),
  };
};
