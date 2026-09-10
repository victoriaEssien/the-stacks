import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenLibraryProvider } from '../OpenLibraryProvider';

const ISBN = '9780000000001';

const stubFetch = (handler: (url: string, init?: RequestInit) => unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => handler(String(url), init)),
  );

const searchResponse = (docs: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ docs }),
});

afterEach(() => vi.unstubAllGlobals());

describe('OpenLibraryProvider.findCover', () => {
  it('checks the cover is really there before claiming it', async () => {
    const calls: (string | undefined)[] = [];
    stubFetch((_url, init) => {
      calls.push(init?.method);
      return { ok: true, status: 200 };
    });

    const result = await new OpenLibraryProvider().findCover({
      isbn13: ISBN,
      title: 'Anything',
      authors: ['Someone'],
    });

    expect(calls).toEqual(['HEAD']);
    expect(result.ok && result.value).toContain(ISBN);
  });

  it('returns nothing when Open Library has no scan for that ISBN', async () => {
    // The failure that started this: a URL was minted from the ISBN regardless,
    // so the book was saved pointing at a permanent 404 - one failed image
    // request on every load, and no sign the book simply has no art.
    stubFetch(() => ({ ok: false, status: 404 }));

    const result = await new OpenLibraryProvider().findCover({
      isbn13: ISBN,
      title: 'Anything',
      authors: ['Someone'],
    });

    expect(result.ok && result.value).toBeUndefined();
  });

  it('claims nothing when the check itself cannot be made', async () => {
    stubFetch(() => {
      throw new Error('offline');
    });

    const result = await new OpenLibraryProvider().findCover({
      isbn13: ISBN,
      title: 'Anything',
      authors: ['Someone'],
    });

    expect(result.ok && result.value).toBeUndefined();
  });
});

describe('OpenLibraryProvider.search', () => {
  it('takes a cover from cover_i and never invents one from an ISBN', async () => {
    stubFetch(() =>
      searchResponse([
        { key: '/works/1', title: 'No Scan', author_name: ['A'], isbn: [ISBN] },
        { key: '/works/2', title: 'Has Scan', author_name: ['B'], cover_i: 42 },
      ]),
    );

    const result = await new OpenLibraryProvider().search('anything');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [noScan, hasScan] = result.value;
    expect(noScan?.coverImage).toBeUndefined();
    expect(noScan?.thumbnailImage).toBeUndefined();
    // The ISBN is still carried, so `findCover` can check it properly later.
    expect(noScan?.isbn13).toBe(ISBN);
    expect(hasScan?.coverImage).toContain('/id/42-');
  });
});
