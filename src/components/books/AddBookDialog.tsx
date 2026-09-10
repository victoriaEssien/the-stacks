import { useState } from 'react';
import type { ExternalBook, ReadingRecord } from '@/models';
import { useBookSearch } from '@/hooks/useBookSearch';
import { useLibraryStore } from '@/stores/libraryStore';
import { ErrorNote, Panel, TextInput } from '@/components/ui';
import { BookDetailsForm } from './BookDetailsForm';
import { BookSearchResults } from './BookSearchResults';

export interface AddBookDialogProps {
  onClose: () => void;
}

/** Search → pick → describe → shelve. */
export const AddBookDialog = ({ onClose }: AddBookDialogProps) => {
  const search = useBookSearch();
  const [chosen, setChosen] = useState<ExternalBook>();
  const [busy, setBusy] = useState(false);

  const addBook = useLibraryStore((state) => state.addBook);
  const storeError = useLibraryStore((state) => state.error);
  const clearError = useLibraryStore((state) => state.clearError);

  const handleSubmit = async (record: ReadingRecord) => {
    if (!chosen) return;
    setBusy(true);
    const created = await addBook({ ...chosen, ...record });
    setBusy(false);
    if (created) onClose();
  };

  return (
    <Panel
      title={chosen ? 'About this book' : 'Add a book'}
      subtitle={chosen ? 'Everything here is optional.' : 'Search by title, author or ISBN.'}
      onClose={onClose}
    >
      {storeError && (
        <div className="mb-4">
          <ErrorNote message={storeError.message} />
        </div>
      )}

      {chosen ? (
        <BookDetailsForm
          book={chosen}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={() => {
            clearError();
            setChosen(undefined);
          }}
        />
      ) : (
        <div className="space-y-4">
          <TextInput
            autoFocus
            type="search"
            value={search.query}
            placeholder="Search title, author, ISBN…"
            aria-label="Search for a book"
            onChange={(event) => search.setQuery(event.target.value)}
          />
          <BookSearchResults
            results={search.results}
            isSearching={search.isSearching}
            hasSearched={search.hasSearched}
            query={search.query}
            errorMessage={search.error?.message}
            onRetry={() => void search.searchNow(search.query)}
            onSelect={(book) => {
              clearError();
              setChosen(book);
            }}
          />
        </div>
      )}
    </Panel>
  );
};
