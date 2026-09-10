import type { Book } from '@/models';
import { authorLine } from '@/models';
import { BookCover } from '@/components/books/BookCover';
import { EmptyState, StarRating } from '@/components/ui';

export interface ListModeLibraryProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
}

/**
 * The non-3D way in. Every book stays reachable on touch devices, on a screen
 * reader, and whenever WebGL is unavailable (spec section 16).
 */
export const ListModeLibrary = ({ books, onSelectBook }: ListModeLibraryProps) => (
  <div className="scroll-warm inset-safe h-full overflow-y-auto bg-ink-900">
    {/* Clears the HUD: its header above, and on touch its action bar below. */}
    <div className="px-4 pb-32 pt-20 sm:px-8 sm:pb-24">
      {books.length === 0 ? (
        <EmptyState
          title="No books yet"
          body="Add the first book you finished and the shelves start to fill."
        />
      ) : (
        <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => onSelectBook(book.id)}
                className="group w-full text-left"
              >
                <BookCover
                  src={book.coverImage}
                  title={book.title}
                  author={book.authors[0]}
                  seed={book.id}
                  className="aspect-2/3 w-full transition-transform group-hover:-translate-y-1"
                />
                <p className="mt-2 line-clamp-2 font-serif text-sm text-parchment">{book.title}</p>
                <p className="line-clamp-1 text-xs text-parchment-dim">{authorLine(book)}</p>
                {book.rating && (
                  <span className="mt-1 inline-block">
                    <StarRating value={book.rating} readOnly size="sm" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
