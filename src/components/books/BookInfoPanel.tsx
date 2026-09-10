import { useState } from 'react';
import type { Book, ReadingRecord } from '@/models';
import { authorLine, publishedYear } from '@/models';
import { useLibraryStore } from '@/stores/libraryStore';
import { Button, Panel, StarRating } from '@/components/ui';
import { BookCover } from './BookCover';
import { BookDetailsForm } from './BookDetailsForm';

export interface BookInfoPanelProps {
  book: Book;
  onClose: () => void;
}

const Detail = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div>
      <dt className="text-xs uppercase tracking-wide text-parchment-dim">{label}</dt>
      <dd className="text-sm text-parchment">{value}</dd>
    </div>
  ) : null;

/** Reads first, edits on demand - the panel floats over the library. */
export const BookInfoPanel = ({ book, onClose }: BookInfoPanelProps) => {
  const [editing, setEditing] = useState(false);
  const updateBook = useLibraryStore((state) => state.updateBook);
  const removeBook = useLibraryStore((state) => state.removeBook);

  const handleSubmit = async (record: ReadingRecord) => {
    await updateBook(book.id, record);
    setEditing(false);
  };

  if (editing) {
    return (
      <Panel title="Edit" subtitle={book.title} onClose={onClose} placement="side">
        <BookDetailsForm
          book={book}
          initial={book}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => setEditing(false)}
        />
      </Panel>
    );
  }

  return (
    <Panel
      title={book.title}
      subtitle={authorLine(book)}
      onClose={onClose}
      placement="side"
      footer={
        <div className="flex items-center justify-between">
          <Button
            variant="danger"
            onClick={() => {
              void removeBook(book.id);
              onClose();
            }}
          >
            Remove
          </Button>
          <Button variant="primary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <BookCover
          src={book.coverImage}
          title={book.title}
          author={book.authors[0]}
          seed={book.id}
          className="mx-auto h-56 w-38"
        />

        <div className="flex items-center justify-center">
          <StarRating value={book.rating} readOnly />
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Started" value={book.dateStarted} />
          <Detail label="Finished" value={book.dateFinished} />
          <Detail label="Publisher" value={book.publisher} />
          <Detail label="Published" value={publishedYear(book)?.toString()} />
          <Detail label="Pages" value={book.pageCount ? String(book.pageCount) : undefined} />
          <Detail label="ISBN" value={book.isbn13 ?? book.isbn10} />
          <Detail
            label="Recommend"
            value={
              book.wouldRecommend === undefined ? undefined : book.wouldRecommend ? 'Yes' : 'No'
            }
          />
          <Detail label="Shelf" value={book.status.replace(/_/g, ' ')} />
        </dl>

        {book.thoughts && (
          <section>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-parchment-dim">Thoughts</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-parchment">
              {book.thoughts}
            </p>
          </section>
        )}

        {book.favoriteQuote && (
          <blockquote className="border-l-2 border-brass pl-3 font-serif text-sm italic text-parchment-dim">
            {book.favoriteQuote}
          </blockquote>
        )}

        {book.description && (
          <section>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-parchment-dim">Summary</h3>
            <p className="text-sm leading-relaxed text-parchment-dim">{book.description}</p>
          </section>
        )}
      </div>
    </Panel>
  );
};
