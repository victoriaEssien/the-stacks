import type { ExternalBook } from '@/models';
import type { Result } from '@/utils/result';

export interface SearchOptions {
  /** Max results to return. Providers may return fewer. */
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Every metadata source implements this. Add a provider by writing a new class
 * here and registering it in `BookService` - nothing else in the app changes.
 */
export interface BookProvider {
  readonly id: string;
  readonly label: string;
  search(query: string, options?: SearchOptions): Promise<Result<ExternalBook[]>>;
  /** Optional: fetch a single volume by the provider's own id. */
  getById?(sourceId: string, options?: SearchOptions): Promise<Result<ExternalBook>>;
  /** Optional: cover-art lookup used as a fallback when the primary has none. */
  findCover?(
    book: Pick<ExternalBook, 'isbn13' | 'isbn10' | 'title' | 'authors'>,
  ): Promise<Result<string | undefined>>;
}
