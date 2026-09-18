import { describe, expect, it, vi } from 'vitest';
import type { ExternalBook } from '@/models';
import { ok, err, appError } from '@/utils/result';
import { BookService } from '../BookService';
import type { BookProvider } from '../types';

const sample = (title: string): ExternalBook => ({
  title,
  authors: ['Someone'],
  source: 'fake',
  sourceId: title,
  coverImage: 'https://example.test/cover.jpg',
});

const provider = (id: string, impl: BookProvider['search']): BookProvider => ({
  id,
  label: id,
  search: impl,
});

describe('BookService', () => {
  it('returns results from the primary provider', async () => {
    const service = new BookService([provider('a', async () => ok([sample('One')]))]);
    const result = await service.search('one');
    expect(result.ok && result.value[0]?.title).toBe('One');
  });

  it('falls back to the next provider when the primary fails', async () => {
    const primary = vi.fn(async () => err(appError('network', 'down')));
    const service = new BookService([
      provider('a', primary),
      provider('b', async () => ok([sample('Two')])),
    ]);

    const result = await service.search('two');
    expect(primary).toHaveBeenCalled();
    expect(result.ok && result.value[0]?.title).toBe('Two');
  });

  it('keeps the reader searching when the primary key is refused', async () => {
    // The chain itself is still worth having even though the app now registers
    // only one search provider: a 403 from the primary must reach whatever is
    // behind it rather than becoming a dead search box.
    const primary = vi.fn(async () => err(appError('forbidden', 'refused')));
    const service = new BookService([
      provider('google', primary),
      provider('openlibrary', async () => ok([sample('Rescued')])),
    ]);

    const result = await service.search('anything');
    expect(primary).toHaveBeenCalled();
    expect(result.ok && result.value[0]?.title).toBe('Rescued');
  });

  /**
   * The app registers ONE search provider now, so there is nothing behind
   * Google to quietly answer in its place. A failure has to reach the reader as
   * a failure - the add dialog shows it with a retry - rather than as an empty
   * result, which reads as "no such book" and is a lie.
   */
  it('surfaces the failure when the only provider fails', async () => {
    const service = new BookService([
      provider('google', async () => err(appError('rate_limited', 'too many'))),
    ]);

    const result = await service.search('anything');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('rate_limited');
  });

  it('still calls an empty result empty, not an error', async () => {
    const service = new BookService([provider('google', async () => ok([]))]);

    const result = await service.search('nothing matches this');
    expect(result.ok && result.value).toEqual([]);
  });

  it('caches identical queries instead of re-hitting the API', async () => {
    const search = vi.fn(async () => ok([sample('Cached')]));
    const service = new BookService([provider('a', search)]);

    await service.search('cached');
    await service.search('cached');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('ignores queries shorter than two characters', async () => {
    const search = vi.fn(async () => ok([sample('Nope')]));
    const service = new BookService([provider('a', search)]);

    const result = await service.search('a');
    expect(search).not.toHaveBeenCalled();
    expect(result.ok && result.value).toEqual([]);
  });
});
