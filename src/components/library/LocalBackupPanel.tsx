import { useLibraryStore } from '@/stores/libraryStore';
import { useMigrationStore } from '@/stores/migrationStore';
import { useSuggestionStore } from '@/stores/suggestionStore';
import { Button, ErrorNote, Panel } from '@/components/ui';

export interface LocalBackupPanelProps {
  onClose: () => void;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Move what this browser was holding into the shared library.
 *
 * Everything added before the library had a database lives in localStorage and
 * nowhere else. It is not lost, it is just not what the app reads any more.
 */
export const LocalBackupPanel = ({ onClose }: LocalBackupPanelProps) => {
  const books = useMigrationStore((state) => state.books);
  const suggestions = useMigrationStore((state) => state.suggestions);
  const busy = useMigrationStore((state) => state.busy);
  const error = useMigrationStore((state) => state.error);
  const importAll = useMigrationStore((state) => state.importAll);
  const dismiss = useMigrationStore((state) => state.dismiss);
  const reloadBooks = useLibraryStore((state) => state.load);
  const reloadSuggestions = useSuggestionStore((state) => state.load);

  const run = async () => {
    if (!(await importAll())) return;
    // Read the shared library back, so what appears is what actually landed
    // rather than what was hoped for.
    await Promise.all([reloadBooks(), reloadSuggestions()]);
    onClose();
  };

  return (
    <Panel
      title="Books held in this browser"
      subtitle="Added before the library had somewhere shared to live."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <Button
            variant="quiet"
            onClick={() => {
              dismiss();
              onClose();
            }}
          >
            Not now
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Moving…' : 'Move to the library'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error.message} />}

        <p className="text-sm leading-relaxed text-parchment-dim">
          This browser is holding {count(books.length, 'book', 'books')} and{' '}
          {count(suggestions.length, 'suggestion', 'suggestions')} that the shared library does not
          have yet. Moving them makes them visible to anyone who visits.
        </p>

        {books.length > 0 && (
          <ul className="space-y-1">
            {books.map((book) => (
              <li key={book.id} className="truncate text-sm text-parchment">
                {book.title}
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-ink-600 pt-3 text-xs leading-relaxed text-parchment-dim/80">
          Nothing is deleted from this browser. The local copy stays exactly where it is, so if
          anything goes wrong it is still the copy you have.
        </p>
      </div>
    </Panel>
  );
};
