import { env } from '@/config/env';
import { isBook, isSuggestion, type Book, type Suggestion } from '@/models';
import { LocalStorageRepository } from './LocalStorageRepository';
import type { Repository } from './types';

const ns = (name: string) => `${env.storageNamespace}:${name}:v1`;

/**
 * The app's two collections. To move to a backend, replace the right-hand side
 * with e.g. `new SupabaseRepository<Book>('books')` - callers are unaffected.
 */
export const bookRepository: Repository<Book> = new LocalStorageRepository<Book>(
  ns('books'),
  isBook,
);

export const suggestionRepository: Repository<Suggestion> = new LocalStorageRepository<Suggestion>(
  ns('suggestions'),
  isSuggestion,
);
