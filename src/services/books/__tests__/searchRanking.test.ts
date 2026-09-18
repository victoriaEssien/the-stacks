import { describe, expect, it } from 'vitest';
import type { ExternalBook } from '@/models';
import {
  dedupeBySource,
  isbnFrom,
  mergeSearchResults,
  rankByRelevance,
  searchQueries,
} from '../searchRanking';

const book = (title: string, authors: string[] = ['Someone'], sourceId = title): ExternalBook => ({
  title,
  authors,
  source: 'google',
  sourceId,
});

const titles = (books: readonly ExternalBook[]) => books.map((b) => b.title);

describe('isbnFrom', () => {
  it('recognises the shapes people actually paste, and strips them', () => {
    expect(isbnFrom('9780062429063')).toBe('9780062429063');
    expect(isbnFrom('978-0-06-242906-3')).toBe('9780062429063');
    expect(isbnFrom(' 978 0 06 242906 3 ')).toBe('9780062429063');
    expect(isbnFrom('006242906X')).toBe('006242906X');
  });

  it('does not mistake a title or a year for one', () => {
    expect(isbnFrom('keep it in the family')).toBeUndefined();
    expect(isbnFrom('1984')).toBeUndefined();
    expect(isbnFrom('slaughterhouse 5')).toBeUndefined();
    // Digits, but the wrong number of them.
    expect(isbnFrom('123456789')).toBeUndefined();
  });
});

describe('searchQueries', () => {
  it('asks by ISBN alone, since the plain form returns nothing at all for one', () => {
    expect(searchQueries('978-0-06-242906-3')).toEqual(['isbn:9780062429063']);
  });

  it('pairs what was typed with an exact-title query', () => {
    expect(searchQueries('keep it in the family')).toEqual([
      'keep it in the family',
      'intitle:"keep it in the family"',
    ]);
  });

  it('adds an author query for something short enough to be a name', () => {
    expect(searchQueries('john marrs')).toEqual([
      'john marrs',
      'intitle:"john marrs"',
      'inauthor:"john marrs"',
    ]);
  });

  it('spends no request on an author query for a phrase no one is called', () => {
    expect(searchQueries('john marrs keep it in')).toHaveLength(2);
  });

  it('puts the plain query first, because its failure fails the search', () => {
    expect(searchQueries('john marrs')[0]).toBe('john marrs');
  });

  it('quotes a query containing a quote, rather than ending the phrase early', () => {
    expect(searchQueries('say "yes"')[1]).toBe('intitle:"say \\"yes\\""');
  });

  it('has nothing to ask for an empty query', () => {
    expect(searchQueries('   ')).toEqual([]);
  });
});

describe('rankByRelevance', () => {
  it('lifts the book whose title is what was typed', () => {
    const ranked = rankByRelevance(
      [
        book('Keeping Layers for the Family'),
        book('The Family Herald'),
        book('Keep It in the Family'),
      ],
      'keep it in the family',
    );
    expect(ranked[0]?.title).toBe('Keep It in the Family');
  });

  it('prefers the exact title over one that merely starts with it', () => {
    const ranked = rankByRelevance(
      [book('Keep It in the Family: A Novel'), book('Keep It in the Family')],
      'keep it in the family',
    );
    expect(titles(ranked)).toEqual(['Keep It in the Family', 'Keep It in the Family: A Novel']);
  });

  it('ignores case and punctuation, which titles are inconsistent about', () => {
    const ranked = rankByRelevance(
      [book('Nope'), book('KEEP IT IN THE FAMILY!')],
      'keep it in the family',
    );
    expect(ranked[0]?.title).toBe('KEEP IT IN THE FAMILY!');
  });

  it('does not score a word it only matches part of', () => {
    // "Keeping" must not count as a match for "keep", or a prefix search would
    // outrank the real title.
    const ranked = rankByRelevance([book('Keeping Score'), book('Keep')], 'keep');
    expect(ranked[0]?.title).toBe('Keep');
  });

  /**
   * The author case has to beat title scoring, not sit under it: for an author
   * search the right books come from the `inauthor:` query and their titles
   * have nothing to do with what was typed.
   */
  it('lifts a book by the author who was searched for', () => {
    const ranked = rankByRelevance(
      [
        book('Study Guide: Dead in the Water', ['SuperSummary']),
        book('Boone Co, AR', ['Unknown']),
        book('The One', ['John Marrs']),
      ],
      'john marrs',
    );
    expect(ranked[0]?.title).toBe('The One');
  });

  it('finds the author among several', () => {
    const ranked = rankByRelevance(
      [book('Noise', ['Someone Else']), book('An Anthology', ['Ada Someone', 'John Marrs'])],
      'john marrs',
    );
    expect(ranked[0]?.title).toBe('An Anthology');
  });

  it("keeps Google's order when nothing matches, since its relevance is all we have", () => {
    const ordered = [book('First'), book('Second'), book('Third')];
    expect(titles(rankByRelevance(ordered, 'unrelated words here'))).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('is stable within a band, so equally good titles stay as they came', () => {
    const ordered = [book('The Family A'), book('The Family B'), book('The Family C')];
    expect(titles(rankByRelevance(ordered, 'the family'))).toEqual([
      'The Family A',
      'The Family B',
      'The Family C',
    ]);
  });
});

describe('dedupeBySource', () => {
  it('keeps the first copy, so the earlier query wins a tie', () => {
    const merged = dedupeBySource([
      book('Plain', ['A'], 'v1'),
      book('From Title Query', ['A'], 'v1'),
    ]);
    expect(titles(merged)).toEqual(['Plain']);
  });

  it('treats the same id from different providers as different books', () => {
    const merged = dedupeBySource([
      book('Google', ['A'], 'v1'),
      { ...book('Open Library', ['A'], 'v1'), source: 'openlibrary' },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('mergeSearchResults', () => {
  /**
   * The case that prompted all of this: searching the title alone returned
   * nothing useful from Google's own relevance, and the book was found only by
   * asking for it as an exact title.
   */
  it('answers a title search from the title query when the plain one missed', () => {
    const plain = [book('Keeping Layers for the Family'), book('The Family Herald')];
    const byTitle = [book('Keep It in the Family')];

    const merged = mergeSearchResults([plain, byTitle], 'keep it in the family', 12);
    expect(merged[0]?.title).toBe('Keep It in the Family');
  });

  it('answers an author search from the author query, over the plain noise', () => {
    const plain = [book('Study Guide: Dead in the Water', ['SuperSummary']), book('Boone Co, AR')];
    const byTitle = [book('Trippings in Author-land', ['Emily Judson'])];
    const byAuthor = [book('The One', ['John Marrs']), book('The Passengers', ['John Marrs'])];

    const merged = mergeSearchResults([plain, byTitle, byAuthor], 'john marrs', 12);
    expect(titles(merged).slice(0, 2)).toEqual(['The One', 'The Passengers']);
  });

  it('leaves an author-plus-title search as Google ranked it', () => {
    const plain = [book('Keep It in the Family', ['John Marrs']), book('Space Warriors')];
    const byTitle = [book('Irrelevant')];
    const merged = mergeSearchResults([plain, byTitle], 'john marrs keep it in', 12);
    expect(merged[0]?.title).toBe('Keep It in the Family');
  });

  it('returns no more than was asked for, despite merging several result sets', () => {
    const sets = [0, 1, 2].map((n) =>
      Array.from({ length: 12 }, (_, i) => book(`Set ${n} book ${i}`, ['A'], `${n}-${i}`)),
    );
    expect(mergeSearchResults(sets, 'something', 12)).toHaveLength(12);
  });

  it('copes with every query but the first having failed', () => {
    expect(titles(mergeSearchResults([[book('Only Result')], [], []], 'only result', 12))).toEqual([
      'Only Result',
    ]);
  });

  it('has nothing to say when every query came back empty', () => {
    expect(mergeSearchResults([[], []], 'nothing', 12)).toEqual([]);
  });
});
