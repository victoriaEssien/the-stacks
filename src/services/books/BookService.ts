import type { ExternalBook } from '@/models';
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
/** A provider consulted only for artwork, never for search results. */
export type CoverFallback = Required<Pick<BookProvider, 'findCover'>>;

export class BookService {
  private readonly providers: BookProvider[];
  private readonly coverFallback?: CoverFallback;
  private readonly searchCache = new Map<string, ExternalBook[]>();

  constructor(providers: BookProvider[], coverFallback?: CoverFallback) {
    if (providers.length === 0) throw new Error('BookService needs at least one provider.');
    this.providers = providers;
    this.coverFallback = coverFallback;
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

  /**
   * Ask the cover fallback for artwork when the search provider had none.
   *
   * Separate from the search chain on purpose. Open Library is no longer wanted
   * in search results - its metadata is thin enough that adding a book from one
   * makes a worse record - but it is still the only place to find a jacket for
   * a book Google has no image for, and that lookup is invisible and verified
   * (`findCover` HEADs the URL before claiming it).
   */
  private async backfillCovers(books: ExternalBook[]): Promise<ExternalBook[]> {
    const fallback = this.coverFallback;
    if (!fallback) return books;

    return Promise.all(
      books.map(async (book) => {
        if (book.coverImage) return book;
        const cover = await fallback.findCover(book);
        return cover.ok && cover.value ? { ...book, coverImage: cover.value } : book;
      }),
    );
  }

  clearCache(): void {
    this.searchCache.clear();
  }
}

/**
 * App-wide instance. Tests should construct their own with fake providers.
 *
 * ONE search provider. Google talks to our own `/api/search`, which holds the
 * key. Open Library used to sit behind it as a search fallback and has been
 * taken out: when it answered, the results were thin (often no page count, no
 * description, a different edition's cover) and a book added from one is a
 * worse record forever. A failed search that says so is better than a bad
 * result that does not. It stays on as the cover fallback only.
 */
export const bookService = new BookService([new GoogleBooksProvider()], new OpenLibraryProvider());
