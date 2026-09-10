import type { ExternalBook } from '@/models';
import { env } from '@/config/env';
import { appError, err, ok, type AppError, type Result } from '@/utils/result';
import { fetchJson, toHttps } from './http';
import type { BookProvider, SearchOptions } from './types';

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

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

  private readonly apiKey?: string;
  /** So a broken key is reported once, not once per keystroke. */
  private warnedAboutKey = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * A 403 with a key set means the key is not usable from here, and the reader
   * would never find out: `BookService` falls through to Open Library and they
   * get results anyway, just with patchier metadata and covers. Correct for
   * them, invisible for whoever has to fix it - so say it out loud in dev.
   */
  private noteRefusal(error: AppError): void {
    if (error.kind !== 'forbidden' || !this.apiKey || this.warnedAboutKey) return;
    this.warnedAboutKey = true;
    if (!env.isDev) return;
    console.warn(
      '[the-stacks] Google Books refused the request (403) even though ' +
        'VITE_GOOGLE_BOOKS_API_KEY is set, so searches are falling back to Open ' +
        'Library. Usually the HTTP referrer restriction on the key: it has to ' +
        `allow this origin (${window.location.origin}/*). Check that, that the ` +
        'Books API is enabled on the same project, and that the key is not also ' +
        'restricted by IP.',
    );
  }

  async search(query: string, options: SearchOptions = {}): Promise<Result<ExternalBook[]>> {
    const trimmed = query.trim();
    if (!trimmed) return ok([]);

    const params = new URLSearchParams({
      q: trimmed,
      maxResults: String(Math.min(options.limit ?? 12, 40)),
      printType: 'books',
    });
    if (this.apiKey) params.set('key', this.apiKey);

    const result = await fetchJson<GoogleVolumesResponse>(`${ENDPOINT}?${params.toString()}`, {
      signal: options.signal,
    });
    if (!result.ok) {
      this.noteRefusal(result.error);
      return result;
    }

    return ok((result.value.items ?? []).map(normalise).filter((b): b is ExternalBook => !!b));
  }

  async getById(sourceId: string, options: SearchOptions = {}): Promise<Result<ExternalBook>> {
    const suffix = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';

    const result = await fetchJson<GoogleVolume>(`${ENDPOINT}/${sourceId}${suffix}`, {
      signal: options.signal,
    });
    if (!result.ok) return result;

    const book = normalise(result.value);
    return book ? ok(book) : err(appError('invalid_response', 'That book had no usable metadata.'));
  }
}
