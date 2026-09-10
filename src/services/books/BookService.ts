import type { ExternalBook } from '@/models';
import { env, type ProviderId } from '@/config/env';
import { appError, err, ok, type Result } from '@/utils/result';
import { GoogleBooksProvider } from './GoogleBooksProvider';
import { OpenLibraryProvider } from './OpenLibraryProvider';
import type { BookProvider, SearchOptions } from './types';

/**
 * Facade over one or more metadata providers.
 *
 * The rest of the app depends on THIS, never on a concrete provider - so a
 * provider can be swapped, reordered or added without touching UI code.
 */
export class BookService {
  private readonly providers: BookProvider[];
  private readonly searchCache = new Map<string, ExternalBook[]>();

  constructor(providers: BookProvider[]) {
    if (providers.length === 0) throw new Error('BookService needs at least one provider.');
    this.providers = providers;
  }

  get primary(): BookProvider {
    return this.providers[0]!;
  }

  /**
   * Search the primary provider, falling back to the next one when it fails or
   * returns nothing. Identical queries are served from an in-memory cache so
   * typing back and forth does not re-hit the API.
   */
  async search(query: string, options: SearchOptions = {}): Promise<Result<ExternalBook[]>> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return ok([]);

    const cacheKey = `${trimmed.toLowerCase()}::${options.limit ?? 12}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return ok(cached);

    let lastError = appError('unknown', 'No provider could handle that search.');

    for (const provider of this.providers) {
      const result = await provider.search(trimmed, options);
      if (!result.ok) {
        lastError = result.error;
        continue;
      }
      if (result.value.length === 0) continue;

      const withCovers = await this.backfillCovers(result.value);
      this.searchCache.set(cacheKey, withCovers);
      return ok(withCovers);
    }

    // Every provider succeeded but found nothing -> an empty list, not an error.
    return lastError.kind === 'unknown' ? ok([]) : err(lastError);
  }

  /** Ask a secondary provider for artwork when the primary had none. */
  private async backfillCovers(books: ExternalBook[]): Promise<ExternalBook[]> {
    const coverProvider = this.providers.find((p) => typeof p.findCover === 'function');
    if (!coverProvider?.findCover) return books;

    return Promise.all(
      books.map(async (book) => {
        if (book.coverImage) return book;
        const cover = await coverProvider.findCover!(book);
        return cover.ok && cover.value ? { ...book, coverImage: cover.value } : book;
      }),
    );
  }

  clearCache(): void {
    this.searchCache.clear();
  }
}

const buildProviders = (preferred: ProviderId): BookProvider[] => {
  const google = new GoogleBooksProvider(env.googleBooksApiKey);
  const openLibrary = new OpenLibraryProvider();
  return preferred === 'openlibrary' ? [openLibrary, google] : [google, openLibrary];
};

/** App-wide instance. Tests should construct their own with fake providers. */
export const bookService = new BookService(buildProviders(env.preferredProvider));
