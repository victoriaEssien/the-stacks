import type { Book } from '@/models';
import { bookDimensions, type BookDimensions } from './bookDimensions';
import { seededRange } from './hash';

/**
 * Shelf placement is COMPUTED, never hand-authored. Add books and the layout
 * wraps to the next shelf, then to the next bookcase, on its own.
 */
export interface ShelfConfig {
  /** Usable inner width of one shelf, in metres. */
  shelfWidth: number;
  /** Clear height between two shelf boards. */
  shelfHeight: number;
  shelfDepth: number;
  /** Number of shelf boards in one bookcase. */
  shelvesPerCase: number;
  /** Gap left between neighbouring books. */
  bookGap: number;
  /** How far a book sits back from the front edge. */
  frontInset: number;
  /** Max backward lean, in radians, of a book resting against the shelf. */
  maxTilt: number;
}

export const DEFAULT_SHELF_CONFIG: ShelfConfig = {
  shelfWidth: 1.6,
  shelfHeight: 0.32,
  shelfDepth: 0.28,
  shelvesPerCase: 5,
  bookGap: 0.012,
  frontInset: 0.03,
  maxTilt: 0.075,
};

export interface BookPlacement {
  bookId: string;
  caseIndex: number;
  shelfIndex: number;
  /** Position relative to the bookcase origin (centre of its floor). */
  position: [number, number, number];
  rotation: [number, number, number];
  dimensions: BookDimensions;
}

export interface ShelfLayout {
  placements: BookPlacement[];
  /** How many bookcases the current collection needs (always >= 1). */
  caseCount: number;
  byId: Record<string, BookPlacement>;
}

/** Y of the surface of shelf `index` within a bookcase. */
export const shelfSurfaceY = (index: number, config: ShelfConfig): number =>
  0.06 + index * config.shelfHeight;

/**
 * Pack books left-to-right along each shelf, wrapping DOWNWARD from the top
 * shelf, then spilling into a new bookcase. Pure and deterministic: same input,
 * same layout.
 *
 * Books stand COVER-OUT, the way a bookshop faces its stock: the cover art is
 * the best thing the metadata providers give us, and a 2cm spine is a miserable
 * click target. A shelf therefore holds far fewer books than a spine-out one.
 *
 * Filling from the top matters more than it looks: shelf 0 is the bottom one,
 * so packing upward from it would put the very first book someone adds at ankle
 * height. The top shelf sits just under eye level.
 */
export const layOutBooks = (
  books: Pick<Book, 'id' | 'pageCount'>[],
  config: ShelfConfig = DEFAULT_SHELF_CONFIG,
): ShelfLayout => {
  const placements: BookPlacement[] = [];

  let caseIndex = 0;
  let shelfIndex = config.shelvesPerCase - 1; // top shelf
  let cursor = 0; // distance consumed along the current shelf

  for (const book of books) {
    const dimensions = bookDimensions(book);
    const footprint = dimensions.width + config.bookGap;

    if (cursor + footprint > config.shelfWidth) {
      cursor = 0;
      shelfIndex -= 1;
      if (shelfIndex < 0) {
        shelfIndex = config.shelvesPerCase - 1;
        caseIndex += 1;
      }
    }

    const x = -config.shelfWidth / 2 + cursor + dimensions.width / 2;
    const y = shelfSurfaceY(shelfIndex, config) + dimensions.height / 2;
    const z = config.shelfDepth / 2 - dimensions.depth / 2 - config.frontInset;

    // A book stood on its bottom edge leans back against the shelf. Tilting
    // about the centre would sink its lower edge through the board, so the
    // height is corrected to keep that edge resting on the surface.
    const lean = -seededRange(book.id, 'lean', config.maxTilt * 0.4, config.maxTilt);
    const sin = Math.abs(Math.sin(lean));
    const cos = Math.cos(lean);

    placements.push({
      bookId: book.id,
      caseIndex,
      shelfIndex,
      position: [
        x,
        y + ((dimensions.depth / 2) * sin + (dimensions.height / 2) * cos - dimensions.height / 2),
        z,
      ],
      rotation: [lean, seededRange(book.id, 'yaw', -0.02, 0.02), 0],
      dimensions,
    });

    cursor += footprint;
  }

  const byId: Record<string, BookPlacement> = {};
  for (const placement of placements) byId[placement.bookId] = placement;

  return { placements, caseCount: Math.max(1, caseIndex + 1), byId };
};

/** Books a single bookcase must render. */
export const placementsForCase = (layout: ShelfLayout, caseIndex: number): BookPlacement[] =>
  layout.placements.filter((placement) => placement.caseIndex === caseIndex);
