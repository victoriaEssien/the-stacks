import { useState } from 'react';
import type { ExternalBook, ReadingRecord, ReadingStatus } from '@/models';
import { Button, Field, StarRating, TextArea, TextInput } from '@/components/ui';
import { BookCover } from './BookCover';

export interface BookDetailsFormProps {
  book: Pick<ExternalBook, 'title' | 'authors' | 'coverImage'>;
  initial?: Partial<ReadingRecord>;
  submitLabel?: string;
  busy?: boolean;
  onSubmit: (record: ReadingRecord) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'read', label: 'Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'want_to_read', label: 'Want to read' },
];

/** The personal layer: rating, dates, thoughts, quote, recommendation. */
export const BookDetailsForm = ({
  book,
  initial,
  submitLabel = 'Add to library',
  busy = false,
  onSubmit,
  onCancel,
}: BookDetailsFormProps) => {
  const [record, setRecord] = useState<ReadingRecord>({
    status: initial?.status ?? 'read',
    rating: initial?.rating,
    dateStarted: initial?.dateStarted,
    dateFinished: initial?.dateFinished,
    thoughts: initial?.thoughts ?? '',
    favoriteQuote: initial?.favoriteQuote ?? '',
    wouldRecommend: initial?.wouldRecommend,
  });

  const patch = (changes: Partial<ReadingRecord>) => setRecord((prev) => ({ ...prev, ...changes }));

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(record);
      }}
    >
      <div className="flex gap-4">
        <BookCover
          src={book.coverImage}
          title={book.title}
          author={book.authors[0]}
          className="h-32 w-22 shrink-0"
        />
        <div>
          <h3 className="font-serif text-lg leading-tight text-parchment">{book.title}</h3>
          <p className="text-sm text-parchment-dim">
            {book.authors.join(', ') || 'Unknown author'}
          </p>
        </div>
      </div>

      <Field label="Shelf">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={record.status === option.value ? 'primary' : 'ghost'}
              onClick={() => patch({ status: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Field>

      <Field label="Rating">
        <StarRating value={record.rating} onChange={(rating) => patch({ rating })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started">
          <TextInput
            type="date"
            value={record.dateStarted ?? ''}
            onChange={(event) => patch({ dateStarted: event.target.value || undefined })}
          />
        </Field>
        <Field label="Finished">
          <TextInput
            type="date"
            value={record.dateFinished ?? ''}
            onChange={(event) => patch({ dateFinished: event.target.value || undefined })}
          />
        </Field>
      </div>

      <Field label="Thoughts">
        <TextArea
          value={record.thoughts}
          placeholder="What stayed with you?"
          onChange={(event) => patch({ thoughts: event.target.value })}
        />
      </Field>

      <Field label="Favourite quote">
        <TextArea
          rows={2}
          value={record.favoriteQuote}
          onChange={(event) => patch({ favoriteQuote: event.target.value })}
        />
      </Field>

      <Field label="Would you recommend it?">
        <div className="flex gap-2">
          <Button
            variant={record.wouldRecommend === true ? 'primary' : 'ghost'}
            onClick={() =>
              patch({ wouldRecommend: record.wouldRecommend === true ? undefined : true })
            }
          >
            Yes
          </Button>
          <Button
            variant={record.wouldRecommend === false ? 'primary' : 'ghost'}
            onClick={() =>
              patch({ wouldRecommend: record.wouldRecommend === false ? undefined : false })
            }
          >
            No
          </Button>
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
