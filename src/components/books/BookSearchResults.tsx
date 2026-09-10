import type { ExternalBook } from '@/models';
import { publishedYear } from '@/models';
import { Button, EmptyState, ErrorNote } from '@/components/ui';
import { BookCover } from './BookCover';

/**
 * What a result will look like, while the provider is still answering. Shaped
 * like the real row so the list does not jump when the results land - a spinner
 * told the reader to wait without telling them what for.
 */
const SkeletonRow = () => (
  <li className="flex items-center gap-3 rounded-md border border-ink-600 p-2.5">
    <span className="skeleton h-20 w-14 shrink-0 rounded-sm" />
    <span className="min-w-0 flex-1 space-y-2">
      <span className="skeleton block h-4 w-2/3 rounded-sm" />
      <span className="skeleton block h-3 w-2/5 rounded-sm" />
      <span className="skeleton block h-2.5 w-1/3 rounded-sm" />
    </span>
  </li>
);

export interface BookSearchResultsProps {
  results: ExternalBook[];
  isSearching: boolean;
  hasSearched: boolean;
  query: string;
  errorMessage?: string;
  onRetry?: () => void;
  onSelect: (book: ExternalBook) => void;
}

export const BookSearchResults = ({
  results,
  isSearching,
  hasSearched,
  query,
  errorMessage,
  onRetry,
  onSelect,
}: BookSearchResultsProps) => {
  if (errorMessage) return <ErrorNote message={errorMessage} onRetry={onRetry} />;

  if (isSearching) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Searching">
        {[0, 1, 2].map((row) => (
          <SkeletonRow key={row} />
        ))}
      </ul>
    );
  }

  if (!hasSearched) {
    return (
      <EmptyState
        title="Find a book"
        body="Search by title, author or ISBN. Cover art and details come from Google Books, with Open Library as a fallback."
      />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="Nothing found"
        body={`No results for “${query}”. Try a different spelling, or just the author's name.`}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {results.map((book) => {
        const art = book.thumbnailImage ?? book.coverImage;

        return (
          <li
            key={`${book.source}:${book.sourceId}`}
            className="flex items-center gap-3 rounded-md border border-ink-600 p-2.5 transition-colors hover:border-ink-500"
          >
            <BookCover
              src={art}
              title={book.title}
              author={book.authors[0]}
              className="h-20 w-14 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-parchment">{book.title}</p>
              <p className="truncate text-sm text-parchment-dim">
                {book.authors.join(', ') || 'Unknown author'}
              </p>
              <p className="mt-0.5 text-xs text-parchment-dim/70">
                {[publishedYear(book), book.publisher, book.pageCount && `${book.pageCount} pp`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {/* The generated cover is designed at 400x600 and renders here at
                56 wide, where its title is far too small to read - so a book the
                provider has no art for looks like a blank row and gets scrolled
                straight past. Say it in words, which do survive the size. */}
              {!art && (
                <p className="mt-1 text-xs italic text-brass/80">
                  No cover art — one will be generated
                </p>
              )}
            </div>
            <Button variant="ghost" onClick={() => onSelect(book)}>
              Add
            </Button>
          </li>
        );
      })}
    </ul>
  );
};
