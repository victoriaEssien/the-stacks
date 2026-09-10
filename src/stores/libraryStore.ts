import { create } from 'zustand';
import {
  bookIdentityKeys,
  type Book,
  type BookEdits,
  type NewBook,
  type ReadingStatus,
} from '@/models';
import { bookRepository } from '@/services/persistence';
import { createId, nowIso } from '@/utils/id';
import { appError, type AppError } from '@/utils/result';
import { DEFAULT_SHELF_CONFIG, layOutBooks, type ShelfLayout } from '@/utils/shelfLayout';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface LibraryState {
  books: Book[];
  loadState: LoadState;
  error?: AppError;
  /**
   * The book added most recently in THIS session, so the 3D layer can animate
   * it onto the shelf. Books restored from storage on startup must not animate,
   * which is why this starts undefined rather than being derived from dates.
   */
  justAddedId?: string;

  load: () => Promise<void>;
  addBook: (input: NewBook) => Promise<Book | undefined>;
  updateBook: (id: string, edits: BookEdits) => Promise<void>;
  setStatus: (id: string, status: ReadingStatus) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  clearJustAdded: () => void;
  findDuplicate: (
    input: Pick<NewBook, 'title' | 'authors' | 'isbn10' | 'isbn13' | 'source' | 'sourceId'>,
  ) => Book | undefined;
  clearError: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  loadState: 'idle',

  load: async () => {
    set({ loadState: 'loading', error: undefined });
    const result = await bookRepository.list();
    if (!result.ok) {
      set({ loadState: 'error', error: result.error });
      return;
    }
    set({ books: result.value, loadState: 'ready' });
  },

  findDuplicate: (input) => {
    const keys = new Set(bookIdentityKeys(input));
    return get().books.find((book) => bookIdentityKeys(book).some((key) => keys.has(key)));
  },

  addBook: async (input) => {
    const existing = get().findDuplicate(input);
    if (existing) {
      set({ error: appError('duplicate', `"${existing.title}" is already on your shelf.`) });
      return undefined;
    }

    const timestamp = nowIso();
    const book: Book = {
      status: 'read',
      ...input,
      id: createId('book'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const result = await bookRepository.save(book);
    if (!result.ok) {
      set({ error: result.error });
      return undefined;
    }

    set((state) => ({
      books: [...state.books, book],
      error: undefined,
      justAddedId: book.status === 'read' ? book.id : undefined,
    }));
    return book;
  },

  updateBook: async (id, edits) => {
    const current = get().books.find((book) => book.id === id);
    if (!current) return;

    const next: Book = { ...current, ...edits, updatedAt: nowIso() };
    // Optimistic: the 3D scene should react immediately.
    set((state) => ({ books: state.books.map((book) => (book.id === id ? next : book)) }));

    const result = await bookRepository.save(next);
    if (!result.ok) {
      set((state) => ({
        books: state.books.map((book) => (book.id === id ? current : book)),
        error: result.error,
      }));
    }
  },

  setStatus: async (id, status) => {
    await get().updateBook(id, { status });
  },

  removeBook: async (id) => {
    const snapshot = get().books;
    set({ books: snapshot.filter((book) => book.id !== id) });

    const result = await bookRepository.remove(id);
    if (!result.ok) set({ books: snapshot, error: result.error });
  },

  clearError: () => set({ error: undefined }),

  clearJustAdded: () => set({ justAddedId: undefined }),
}));

/**
 * Books that belong on the physical shelves - "read" only, oldest first.
 * Returns a fresh array each call, so read it through `useShallow` - a bare
 * `useLibraryStore(selectShelvedBooks)` re-renders forever under zustand v5.
 */
export const selectShelvedBooks = (state: LibraryState): Book[] =>
  state.books
    .filter((book) => book.status === 'read')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const selectCurrentlyReading = (state: LibraryState): Book | undefined =>
  state.books.find((book) => book.status === 'reading');

export const selectBookById = (id: string | undefined) => (state: LibraryState) =>
  id ? state.books.find((book) => book.id === id) : undefined;

/** Computed shelf layout for the read shelf. Cheap enough to derive per call. */
export const buildLayout = (books: Book[]): ShelfLayout => layOutBooks(books, DEFAULT_SHELF_CONFIG);
