import { isBook, isSuggestion, type Book, type Suggestion } from '@/models';
import { storageKey } from './keys';
import { LocalStorageRepository } from './LocalStorageRepository';

/**
 * The collections still sitting in this browser, read DIRECTLY rather than
 * through `bookRepository`.
 *
 * Once the app is pointed at Neon those two are no longer the same thing: the
 * repository talks to the database, and anything added before the switch is
 * invisible but not gone. This is how it is recovered, and it stays available
 * afterwards so nothing is ever deleted on the strength of a migration having
 * "probably" worked.
 */
export const localBookBackup = new LocalStorageRepository<Book>(storageKey('books'), isBook);

export const localSuggestionBackup = new LocalStorageRepository<Suggestion>(
  storageKey('suggestions'),
  isSuggestion,
);
