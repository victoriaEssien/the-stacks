import { isBook, isSuggestion, type Book, type Suggestion } from '@/models';
import { neonClient } from '@/services/neon';
import { storageKey } from './keys';
import { LocalStorageRepository } from './LocalStorageRepository';
import { NeonRepository } from './NeonRepository';
import type { Repository } from './types';

/**
 * The app's two collections, chosen by configuration.
 *
 * With `VITE_NEON_URL` set the library is shared and a visitor can see
 * it; without it everything stays in this browser. Callers are unaffected
 * either way, which is the whole point of `Repository<T>`.
 */
const client = neonClient();

const bookStore: Repository<Book> = client
  ? new NeonRepository<Book>('books', isBook, client)
  : new LocalStorageRepository<Book>(storageKey('books'), isBook);

const suggestionStore: Repository<Suggestion> = client
  ? new NeonRepository<Suggestion>('suggestions', isSuggestion, client)
  : new LocalStorageRepository<Suggestion>(storageKey('suggestions'), isSuggestion);

export const bookRepository = bookStore;
export const suggestionRepository = suggestionStore;
