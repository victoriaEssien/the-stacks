import { describe, expect, it } from 'vitest';
import type { Book } from '@/models';
import { isBook } from '@/models';
import { NeonRepository, type NeonDataClient, type NeonQueryResult } from '../NeonRepository';
import { fromRow, toColumn, toField, toRow } from '../rows';

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

interface Recorded {
  table: string;
  op: string;
  args: unknown[];
}

/** A stand-in for the Neon client, so none of this touches a network. */
const fake = (result: NeonQueryResult | (() => never)) => {
  const calls: Recorded[] = [];
  const answer = (table: string, op: string, args: unknown[]) => {
    calls.push({ table, op, args });
    if (typeof result === 'function') return result();
    return Promise.resolve(result);
  };

  const client: NeonDataClient = {
    from: (table) => ({
      select: () => answer(table, 'select', []),
      upsert: (rows) => answer(table, 'upsert', [rows]),
      delete: () => ({
        eq: (column, value) => answer(table, 'delete.eq', [column, value]),
        not: (column, operator, value) => answer(table, 'delete.not', [column, operator, value]),
      }),
    }),
  };

  return { client, calls };
};

const repo = (result: NeonQueryResult | (() => never)) => {
  const { client, calls } = fake(result);
  return { store: new NeonRepository<Book>('books', isBook, client), calls };
};

const okResult = (data: unknown = null): NeonQueryResult => ({ data, error: null });
const failResult = (code: string | null): NeonQueryResult => ({
  data: null,
  error: { message: 'nope', code },
});

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
  it('reads the shelf and maps rows back to models', async () => {
    const { store, calls } = repo(okResult([toRow(BOOK)]));
    const result = await store.list();

    expect(result.ok && result.value).toEqual([BOOK]);
    expect(calls).toEqual([{ table: 'books', op: 'select', args: [] }]);
  });

  it('drops rows that no longer match the schema instead of crashing', async () => {
    const { store } = repo(okResult([toRow(BOOK), { id: 'broken', title: 'No status' }]));
    const result = await store.list();
    expect(result.ok && result.value).toHaveLength(1);
  });

  it('refuses to believe a non-array is a shelf', async () => {
    const { store } = repo(okResult({ not: 'an array' }));
    const result = await store.list();
    expect(!result.ok && result.error.kind).toBe('invalid_response');
  });

  it('upserts on save, so a second save is an edit rather than a clash', async () => {
    const { store, calls } = repo(okResult());
    const result = await store.save(BOOK);

    expect(result.ok).toBe(true);
    expect(calls[0]?.op).toBe('upsert');
    expect(calls[0]?.args[0]).toEqual([toRow(BOOK)]);
  });

  it('sends every book in one upsert', async () => {
    const { store, calls } = repo(okResult());
    await store.saveMany([BOOK, { ...BOOK, id: 'book_2' }]);
    expect((calls[0]?.args[0] as unknown[]).length).toBe(2);
  });

  it('does not call out at all for an empty saveMany', async () => {
    const { store, calls } = repo(okResult());
    const result = await store.saveMany([]);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('filters a delete by id', async () => {
    const { store, calls } = repo(okResult());
    await store.remove('book_1');
    expect(calls[0]).toEqual({ table: 'books', op: 'delete.eq', args: ['id', 'book_1'] });
  });

  it('never sends an unfiltered delete, which PostgREST would refuse anyway', async () => {
    const { store, calls } = repo(okResult());
    await store.clear();
    expect(calls[0]).toEqual({ table: 'books', op: 'delete.not', args: ['id', 'is', null] });
  });

  it('calls a write the database refused on privileges what it is', async () => {
    // 42501 is RLS saying no, which means "not the owner", not "outage".
    const { store } = repo(failResult('42501'));
    const result = await store.save(BOOK);
    expect(!result.ok && result.error.kind).toBe('forbidden');
  });

  it('treats an expired token as something to sign in again for', async () => {
    const { store } = repo(failResult('PGRST301'));
    const result = await store.save(BOOK);
    expect(!result.ok && result.error.kind).toBe('forbidden');
    expect(!result.ok && result.error.message).toContain('expired');
  });

  it('reports anything else as a persistence failure', async () => {
    const { store } = repo(failResult(null));
    const result = await store.list();
    expect(!result.ok && result.error.kind).toBe('persistence');
  });

  it('survives the client throwing rather than returning an error', async () => {
    const { store } = repo(() => {
      throw new Error('AuthRequiredError');
    });
    const result = await store.list();
    expect(!result.ok && result.error.kind).toBe('persistence');
  });
});
