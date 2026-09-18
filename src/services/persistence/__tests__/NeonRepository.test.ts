import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Book } from '@/models';
import { isBook } from '@/models';
import { NeonRepository } from '../NeonRepository';
import { fromRow, toColumn, toField, toRow } from '../rows';

const BASE = 'https://api.example.test/v1';

const BOOK: Book = {
  id: 'book_1',
  title: 'A Quiet Inventory',
  authors: ['Someone Else'],
  status: 'read',
  rating: 4.5,
  favoriteQuote: 'Stayed with me.',
  pageCount: 240,
  source: 'test',
  sourceId: 'test-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

interface Call {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: unknown;
}

const calls: Call[] = [];

const stub = (status: number, payload: unknown = []) => {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
      };
    }),
  );
};

const repo = (getToken?: () => string | undefined) =>
  new NeonRepository<Book>('books', isBook, { baseUrl: BASE, getToken });

afterEach(() => vi.unstubAllGlobals());

describe('rows', () => {
  it('converts between model fields and columns', () => {
    expect(toColumn('coverImage')).toBe('cover_image');
    expect(toColumn('favoriteQuote')).toBe('favorite_quote');
    expect(toField('would_recommend')).toBe('wouldRecommend');
    expect(toField('preview_url')).toBe('previewUrl');
  });

  it('leaves ISBN fields alone, digits and all', () => {
    for (const field of ['isbn10', 'isbn13']) {
      expect(toColumn(field)).toBe(field);
      expect(toField(field)).toBe(field);
    }
  });

  it('round-trips every field of a book', () => {
    expect(fromRow(toRow(BOOK) as Record<string, unknown>)).toEqual(BOOK);
  });

  it('sends a cleared field as null rather than omitting it', () => {
    // The store saves the whole book after an edit, so a quote the reader
    // deleted arrives as undefined. Omitting the key would leave the old text
    // sitting in the column.
    const row = toRow({ ...BOOK, favoriteQuote: undefined });
    expect('favorite_quote' in row).toBe(true);
    expect(row.favorite_quote).toBeNull();
  });

  it('treats a null column as an absent optional field', () => {
    const entity = fromRow({ id: 'x', title: 'T', status: 'read', thoughts: null });
    expect('thoughts' in entity).toBe(false);
  });
});

describe('NeonRepository', () => {
  it('reads the shelf without a token, as any visitor would', async () => {
    stub(200, [toRow(BOOK)]);
    const result = await repo().list();

    expect(result.ok && result.value).toEqual([BOOK]);
    expect(calls[0]?.url).toBe(`${BASE}/books?select=*`);
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('drops rows that no longer match the schema instead of crashing', async () => {
    stub(200, [toRow(BOOK), { id: 'broken', title: 'No status' }]);
    const result = await repo().list();
    expect(result.ok && result.value).toHaveLength(1);
  });

  it('upserts on save, so a second save is an edit rather than a clash', async () => {
    stub(201);
    const result = await repo().save(BOOK);

    expect(result.ok).toBe(true);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.Prefer).toContain('merge-duplicates');
    expect(calls[0]?.body).toEqual([toRow(BOOK)]);
  });

  it('sends the owner token when there is one', async () => {
    stub(201);
    await repo(() => 'jwt-123').save(BOOK);
    expect(calls[0]?.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('asks for the token per call, so an expired one is never reused', async () => {
    // Data API JWTs last about fifteen minutes.
    const tokens = ['first', 'second'];
    stub(201);
    const store = repo(() => tokens.shift());
    await store.save(BOOK);
    await store.save(BOOK);
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer first', 'Bearer second']);
  });

  it('filters a delete by id, and never sends an unfiltered one', async () => {
    stub(204);
    await repo().remove('book/1');
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toBe(`${BASE}/books?id=eq.book%2F1`);

    stub(204);
    await repo().clear();
    expect(calls[0]?.url).toContain('id=not.is.null');
  });

  it('survives a 204 with no body', async () => {
    stub(204);
    const result = await repo().remove('book_1');
    expect(result.ok).toBe(true);
  });

  it('calls a refused write what it is, rather than an outage', async () => {
    stub(403);
    const result = await repo().save(BOOK);
    expect(!result.ok && result.error.kind).toBe('forbidden');
  });

  it('reports anything else as a persistence failure', async () => {
    stub(500);
    const result = await repo().list();
    expect(!result.ok && result.error.kind).toBe('persistence');
  });

  it('does not call out at all for an empty saveMany', async () => {
    stub(201);
    const result = await repo().saveMany([]);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('tolerates a trailing slash on the configured base url', async () => {
    stub(200, []);
    await new NeonRepository<Book>('books', isBook, { baseUrl: `${BASE}/` }).list();
    expect(calls[0]?.url).toBe(`${BASE}/books?select=*`);
  });
});
