import type { ExternalBook } from '@/models';
import { ok, type Result } from '@/utils/result';
import { coverUrlFromId, coverUrlFromIsbn } from './covers';
import { fetchJson } from './http';
import type { BookProvider, SearchOptions } from './types';

const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';
interface OpenLibraryDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  isbn?: string[];
  cover_i?: number;
  cover_edition_key?: string;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[];
}

const pickIsbn = (isbns: string[] | undefined, length: 10 | 13) =>
  isbns?.find((value) => value.replace(/[^0-9Xx]/g, '').length === length);

const normalise = (doc: OpenLibraryDoc): ExternalBook | undefined => {
  if (!doc.title) return undefined;
  const isbn13 = pickIsbn(doc.isbn, 13);
  const isbn10 = pickIsbn(doc.isbn, 10);

  // ONLY from `cover_i`. Open Library will mint a URL for any ISBN you hand it
  // and `default=false` then 404s when there is no scan behind it, so building
  // one from an ISBN here would stamp a permanently dead URL onto the book.
  // `findCover` may still try an ISBN, but it checks first.
  const cover = doc.cover_i ? coverUrlFromId(doc.cover_i, 'L') : undefined;

  return {
    title: doc.subtitle ? `${doc.title}: ${doc.subtitle}` : doc.title,
    authors: doc.author_name ?? [],
    coverImage: cover,
    thumbnailImage: doc.cover_i ? coverUrlFromId(doc.cover_i, 'M') : cover,
    isbn10,
    isbn13,
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    pageCount: doc.number_of_pages_median,
    categories: doc.subject?.slice(0, 6),
    previewUrl: doc.key ? `https://openlibrary.org${doc.key}` : undefined,
    source: 'openlibrary',
    sourceId: doc.key ?? doc.cover_edition_key ?? doc.title,
  };
};

export class OpenLibraryProvider implements BookProvider {
  readonly id = 'openlibrary';
  readonly label = 'Open Library';

  async search(query: string, options: SearchOptions = {}): Promise<Result<ExternalBook[]>> {
    const trimmed = query.trim();
    if (!trimmed) return ok([]);

    const params = new URLSearchParams({
      q: trimmed,
      limit: String(Math.min(options.limit ?? 12, 40)),
      fields:
        'key,title,subtitle,author_name,first_publish_year,publisher,number_of_pages_median,subject,isbn,cover_i,cover_edition_key',
    });

    const result = await fetchJson<OpenLibrarySearchResponse>(
      `${SEARCH_ENDPOINT}?${params.toString()}`,
      { signal: options.signal },
    );
    if (!result.ok) return result;

    return ok((result.value.docs ?? []).map(normalise).filter((b): b is ExternalBook => !!b));
  }

  /**
   * Whether there is actually a scan behind a cover URL.
   *
   * Worth a HEAD request: the alternative is claiming a cover that is not
   * there, which costs a failed image request on every load of the library
   * forever after, and hides from the reader that the book has no art at all.
   */
  private async coverExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Cover-only lookup, used to backfill artwork the primary provider lacked. */
  async findCover(
    book: Pick<ExternalBook, 'isbn13' | 'isbn10' | 'title' | 'authors'>,
  ): Promise<Result<string | undefined>> {
    const isbn = book.isbn13 ?? book.isbn10;
    if (isbn) {
      const url = coverUrlFromIsbn(isbn, 'L');
      return ok((await this.coverExists(url)) ? url : undefined);
    }

    const query = [book.title, book.authors[0]].filter(Boolean).join(' ');
    const result = await this.search(query, { limit: 1 });
    if (!result.ok) return result;
    return ok(result.value[0]?.coverImage);
  }
}
