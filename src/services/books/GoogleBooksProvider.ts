import type { ExternalBook } from '@/models';
import { env } from '@/config/env';
import { appError, err, ok, type AppError, type Result } from '@/utils/result';
import { fetchJson, toHttps } from './http';
import { SEARCH_PROXY_PATH } from './endpoints';
import { mergeSearchResults, searchQueries } from './searchRanking';
import type { BookProvider, SearchOptions } from './types';

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    previewLink?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    imageLinks?: Record<string, string | undefined>;
  };
}

interface GoogleVolumesResponse {
  totalItems?: number;
  items?: GoogleVolume[];
}

const normalise = (volume: GoogleVolume): ExternalBook | undefined => {
  const info = volume.volumeInfo;
  if (!info?.title) return undefined;

  const ids = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier;

  const images = info.imageLinks ?? {};
  const cover = toHttps(
    images.extraLarge ?? images.large ?? images.medium ?? images.thumbnail ?? images.smallThumbnail,
  );
  const thumbnail = toHttps(images.thumbnail ?? images.smallThumbnail ?? cover);

  return {
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    authors: info.authors ?? [],
    description: info.description,
    coverImage: cover?.replace(/&edge=curl/, ''),
    thumbnailImage: thumbnail,
    isbn10,
    isbn13,
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    pageCount: info.pageCount,
    categories: info.categories,
    previewUrl: info.previewLink,
    source: 'google',
    sourceId: volume.id,
  };
};

export class GoogleBooksProvider implements BookProvider {
  readonly id = 'google';
  readonly label = 'Google Books';

  /**
   * Our own search endpoint by default, which holds the API key. Overridable so
   * a test can point it somewhere it controls; the response shape is Google's
   * either way, because `/api/search` passes it through untouched.
   */
  private readonly endpoint: string;
  /** So a refusal is reported once, not once per keystroke. */
  private warnedAboutRefusal = false;

  constructor(endpoint: string = SEARCH_PROXY_PATH) {
    this.endpoint = endpoint;
  }

  /**
   * A 403 means the search endpoint refused us, and the reader would never find
   * out: `BookService` falls through to Open Library and they get results
   * anyway, just with patchier metadata and covers. Correct for them, invisible
   * for whoever has to fix it - so say it out loud in dev.
   */
  private noteRefusal(error: AppError): void {
    if (error.kind !== 'forbidden' || this.warnedAboutRefusal) return;
    this.warnedAboutRefusal = true;
    if (!env.isDev) return;
    console.warn(
      `[the-stacks] ${this.endpoint} refused the request (403), so searches are ` +
        'falling back to Open Library. Either GOOGLE_BOOKS_API_KEY is not usable ' +
        '(check that the Books API is enabled on the same project, and that any ' +
        `HTTP referrer restriction allows ${window.location.origin}/*), or the ` +
        'request did not look like it came from this site. Note the key is NOT a ' +
        'VITE_ variable any more: it is read by the server, so `pnpm dev` picks ' +
        'up a change to it only on restart.',
    );
  }

  /** One request to Google, already normalised. */
  private async volumes(
    query: string,
    limit: number,
    options: SearchOptions,
  ): Promise<Result<ExternalBook[]>> {
    const params = new URLSearchParams({ q: query, maxResults: String(limit) });

    const result = await fetchJson<GoogleVolumesResponse>(`${this.endpoint}?${params.toString()}`, {
      signal: options.signal,
    });
    if (!result.ok) return result;

    return ok((result.value.items ?? []).map(normalise).filter((b): b is ExternalBook => !!b));
  }

  /**
   * Several searches in parallel, merged and re-ranked.
   *
   * See `searchRanking.ts` for the measurements behind this. In short, Google's
   * own relevance finds a book neither by its title alone nor by its author
   * alone, and returns nothing whatsoever for an ISBN, so the field-qualified
   * forms do the real work - but none of them can replace the plain query,
   * because the author-plus-title phrasing a reader falls back to matches no
   * single field.
   */
  async search(query: string, options: SearchOptions = {}): Promise<Result<ExternalBook[]>> {
    const trimmed = query.trim();
    if (!trimmed) return ok([]);

    const limit = Math.min(options.limit ?? 12, 40);
    const queries = searchQueries(trimmed);

    const results = await Promise.all(queries.map((q) => this.volumes(q, limit, options)));

    // Only the FIRST query is allowed to fail the search. The rest improve the
    // answer; they are not the answer.
    const [primary] = results;
    if (primary && !primary.ok) {
      this.noteRefusal(primary.error);
      return primary;
    }

    const sets = results.map((result) => (result.ok ? result.value : []));
    return ok(mergeSearchResults(sets, trimmed, limit));
  }

  async getById(sourceId: string, options: SearchOptions = {}): Promise<Result<ExternalBook>> {
    const params = new URLSearchParams({ id: sourceId });

    const result = await fetchJson<GoogleVolume>(`${this.endpoint}?${params.toString()}`, {
      signal: options.signal,
    });
    if (!result.ok) return result;

    const book = normalise(result.value);
    return book ? ok(book) : err(appError('invalid_response', 'That book had no usable metadata.'));
  }
}
