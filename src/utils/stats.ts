import type { Book } from '@/models';

export interface ReadingStats {
  booksRead: number;
  booksThisYear: number;
  pagesRead: number;
  averageRating?: number;
  currentlyReading: Book[];
  wantToRead: number;
  topAuthor?: { name: string; count: number };
}

const finishedYear = (book: Book): number | undefined => {
  if (!book.dateFinished) return undefined;
  const year = new Date(book.dateFinished).getFullYear();
  return Number.isNaN(year) ? undefined : year;
};

/** Lightweight, non-nagging statistics. Deliberately no streaks or quotas. */
export const computeStats = (books: Book[], now = new Date()): ReadingStats => {
  const read = books.filter((book) => book.status === 'read');
  const rated = read.filter((book) => typeof book.rating === 'number');

  const authorCounts = new Map<string, number>();
  for (const book of read) {
    for (const author of book.authors) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
  }
  const [topName, topCount] = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  return {
    booksRead: read.length,
    booksThisYear: read.filter((book) => finishedYear(book) === now.getFullYear()).length,
    pagesRead: read.reduce((total, book) => total + (book.pageCount ?? 0), 0),
    averageRating:
      rated.length > 0
        ? Number(
            (rated.reduce((total, book) => total + (book.rating ?? 0), 0) / rated.length).toFixed(
              1,
            ),
          )
        : undefined,
    currentlyReading: books.filter((book) => book.status === 'reading'),
    wantToRead: books.filter((book) => book.status === 'want_to_read').length,
    topAuthor: topName ? { name: topName, count: topCount ?? 0 } : undefined,
  };
};
