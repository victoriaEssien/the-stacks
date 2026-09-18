import { create } from 'zustand';
import type { Book, Suggestion } from '@/models';
import {
  bookRepository,
  localBookBackup,
  localSuggestionBackup,
  suggestionRepository,
} from '@/services/persistence';
import type { AppError } from '@/utils/result';

interface MigrationState {
  books: Book[];
  suggestions: Suggestion[];
  scanned: boolean;
  busy: boolean;
  /** Set once the import has succeeded, so the offer stops being made. */
  imported: boolean;
  error?: AppError;

  scan: () => Promise<void>;
  importAll: () => Promise<boolean>;
  dismiss: () => void;
}

/**
 * Moving what is already in this browser into the shared library.
 *
 * Deliberately an action the reader takes, not something that happens on load.
 * A silent import that half-finishes leaves a library nobody can reason about;
 * an explicit one reports what it did. Nothing is deleted from localStorage
 * afterwards either - it is the only copy until the database has it, and it
 * costs nothing to leave behind as a backup.
 */
export const useMigrationStore = create<MigrationState>((set, get) => ({
  books: [],
  suggestions: [],
  scanned: false,
  busy: false,
  imported: false,

  scan: async () => {
    const [books, suggestions] = await Promise.all([
      localBookBackup.list(),
      localSuggestionBackup.list(),
    ]);
    set({
      books: books.ok ? books.value : [],
      suggestions: suggestions.ok ? suggestions.value : [],
      scanned: true,
    });
  },

  importAll: async () => {
    const { books, suggestions } = get();
    set({ busy: true, error: undefined });

    // Upserts, so running this twice is harmless rather than a pile of
    // duplicate-key failures.
    const savedBooks = await bookRepository.saveMany(books);
    if (!savedBooks.ok) {
      set({ busy: false, error: savedBooks.error });
      return false;
    }

    const savedSuggestions = await suggestionRepository.saveMany(suggestions);
    if (!savedSuggestions.ok) {
      set({ busy: false, error: savedSuggestions.error });
      return false;
    }

    set({ busy: false, imported: true });
    return true;
  },

  dismiss: () => set({ imported: true }),
}));

/** True when there is something here that the shared library does not have. */
export const selectHasLocalBooks = (state: MigrationState): boolean =>
  state.scanned && !state.imported && state.books.length + state.suggestions.length > 0;
