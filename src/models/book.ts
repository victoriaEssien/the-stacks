/**
 * The application's INTERNAL book model.
 *
 * Nothing outside `services/books` should ever see a Google Books or Open
 * Library response shape. Providers normalise into `ExternalBook`; the library
 * stores `Book`.
 */

export const READING_STATUSES = ['want_to_read', 'reading', 'read'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

/** An ISO-8601 date string (`YYYY-MM-DD`) or full timestamp. */
export type IsoDate = string;

/** Book data as it comes back from an external metadata provider. */
export interface ExternalBook {
  title: string;
  authors: string[];
  description?: string;
  coverImage?: string;
  thumbnailImage?: string;
  isbn10?: string;
  isbn13?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  previewUrl?: string;
  /** Which provider produced this record, e.g. `google`. */
  source: string;
  /** The provider's own id for the volume. */
  sourceId: string;
}

/** The personal layer the reader adds on top of the metadata. */
export interface ReadingRecord {
  status: ReadingStatus;
  dateStarted?: IsoDate;
  dateFinished?: IsoDate;
  /** 0.5 - 5, in half steps. */
  rating?: number;
  thoughts?: string;
  favoriteQuote?: string;
  wouldRecommend?: boolean;
}

export interface Book extends ExternalBook, ReadingRecord {
  id: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** Everything needed to create a Book, minus the fields the store owns. */
export type NewBook = ExternalBook & Partial<ReadingRecord>;

/** The subset a user may edit from the info panel. */
export type BookEdits = Partial<ReadingRecord> & Partial<Pick<Book, 'coverImage'>>;

export const isReadingStatus = (value: unknown): value is ReadingStatus =>
  typeof value === 'string' && (READING_STATUSES as readonly string[]).includes(value);

export const isBook = (value: unknown): value is Book => {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Partial<Book>;
  return (
    typeof b.id === 'string' &&
    typeof b.title === 'string' &&
    Array.isArray(b.authors) &&
    isReadingStatus(b.status)
  );
};

export const primaryAuthor = (book: Pick<Book, 'authors'>): string =>
  book.authors[0] ?? 'Unknown author';

export const authorLine = (book: Pick<Book, 'authors'>): string =>
  book.authors.length > 0 ? book.authors.join(', ') : 'Unknown author';

/** Year as a number when the provider gave us something parseable. */
export const publishedYear = (book: Pick<Book, 'publishedDate'>): number | undefined => {
  const match = book.publishedDate?.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
};

/**
 * Two records describe the same book when they share an ISBN, or a provider id,
 * or (as a last resort) a normalised title + first author.
 */
export const bookIdentityKeys = (book: Partial<ExternalBook>): string[] => {
  const keys: string[] = [];
  if (book.isbn13) keys.push(`isbn13:${book.isbn13}`);
  if (book.isbn10) keys.push(`isbn10:${book.isbn10}`);
  if (book.source && book.sourceId) keys.push(`src:${book.source}:${book.sourceId}`);
  if (book.title) {
    const title = book.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const author = (book.authors?.[0] ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    keys.push(`ta:${title}|${author}`);
  }
  return keys;
};
