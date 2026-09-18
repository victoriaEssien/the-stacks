import { env } from '@/config/env';
import { isBook, isSuggestion, type Book, type Suggestion } from '@/models';
import { LocalStorageRepository } from './LocalStorageRepository';
import { NeonRepository } from './NeonRepository';
import type { Repository } from './types';

const ns = (name: string) => `${env.storageNamespace}:${name}:v1`;

/**
 * The app's two collections, chosen by configuration.
 *
 * With `VITE_NEON_DATA_API_URL` set the library is shared and a visitor can see
 * it; without it everything stays in this browser. Callers are unaffected
 * either way, which is the whole point of `Repository<T>`.
 */
const remote = (table: string) => env.neonDataApiUrl && { baseUrl: env.neonDataApiUrl, table };

const bookStore = remote('books');
export const bookRepository: Repository<Book> = bookStore
  ? new NeonRepository<Book>(bookStore.table, isBook, { baseUrl: bookStore.baseUrl })
  : new LocalStorageRepository<Book>(ns('books'), isBook);

const suggestionStore = remote('suggestions');
export const suggestionRepository: Repository<Suggestion> = suggestionStore
  ? new NeonRepository<Suggestion>(suggestionStore.table, isSuggestion, {
      baseUrl: suggestionStore.baseUrl,
    })
  : new LocalStorageRepository<Suggestion>(ns('suggestions'), isSuggestion);
