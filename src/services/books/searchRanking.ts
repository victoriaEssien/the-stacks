/**
 * Making Google Books find the book someone actually meant.
 *
 * Its default relevance is poor at every shape of search a reader performs.
 * Measured against the live API, looking for John Marrs and his novel
 * "Keep It in the Family", and for Pretty Girls by its ISBN:
 *
 *   q=keep it in the family              not in the first 40 results
 *   q=intitle:"keep it in the family"    third result
 *   q=john marrs                         no book by him at all: a study guide,
 *                                        then county records and genealogy
 *   q=inauthor:"john marrs"              first result
 *   q=9780062429063                      ZERO results
 *   q=isbn:9780062429063                 exactly the right book
 *
 * So the field-qualified forms are the ones that work, and no single one of
 * them can replace the plain query: `intitle:"john marrs keep it in"` matches
 * no title, and that phrasing is exactly what a reader falls back to when the
 * title alone failed. `q OR intitle:"q"` was measured too and finds neither.
 *
 * Hence several queries in parallel, merged, with whatever actually matches
 * what was typed lifted to the top. Within a band the order Google gave is
 * kept, because when nothing matches by name its relevance is all there is.
 */

import type { ExternalBook } from '@/models';

/** Letters and digits only, so punctuation and case stop mattering. */
const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * A person's name is short. A longer phrase is a title, or a title with an
 * author attached, and asking for it as an author wastes a request against a
 * daily quota.
 */
const MAX_NAME_WORDS = 3;

/** An ISBN, reduced to the form Google wants, or `undefined`. */
export const isbnFrom = (query: string): string | undefined => {
  const trimmed = query.trim();
  if (!/^[0-9-\s]*[0-9Xx]$/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/[^0-9Xx]/g, '').toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : undefined;
};

/**
 * Every query to run for this search, the FIRST being the one whose failure
 * counts as the search failing.
 *
 * An ISBN replaces the plain query rather than joining it, because the plain
 * form returns nothing at all for one and there is no ambiguity to hedge
 * against: an ISBN identifies exactly one book.
 *
 * `JSON.stringify` does the quoting, which matters: a title containing a double
 * quote would otherwise end the phrase early and change what is being asked.
 */
export const searchQueries = (query: string): string[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isbn = isbnFrom(trimmed);
  if (isbn) return [`isbn:${isbn}`];

  const queries = [trimmed, `intitle:${JSON.stringify(trimmed)}`];
  if (normalise(trimmed).split(' ').length <= MAX_NAME_WORDS) {
    queries.push(`inauthor:${JSON.stringify(trimmed)}`);
  }
  return queries;
};

/**
 * How well a book answers what was typed. Higher wins.
 *
 * Author matches score as highly as a strong title match, and they have to:
 * for an author search the useful results come from the `inauthor:` query and
 * their TITLES have nothing to do with the query, so scoring titles alone would
 * leave Google's plain-query noise sitting on top of them.
 */
const score = (book: ExternalBook, query: string): number => {
  const wanted = normalise(query);
  if (!wanted) return 0;

  const title = normalise(book.title);
  if (title === wanted) return 3;

  const authors = normalise(book.authors.join(' '));
  if (authors.includes(wanted)) return 2;

  // The trailing space is what stops "Keeping Layers" scoring for "keep": a
  // match has to end on a word boundary, not part way through one.
  if (title.startsWith(`${wanted} `)) return 2;
  if (title.includes(wanted)) return 1;
  return 0;
};

/** First occurrence wins, so the earlier query keeps precedence on a tie. */
export const dedupeBySource = (books: readonly ExternalBook[]): ExternalBook[] => {
  const seen = new Set<string>();
  return books.filter((book) => {
    const key = `${book.source}:${book.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Books that match what was typed, first. A stable sort, so results Google
 * ranked equally stay in the order it gave them.
 */
export const rankByRelevance = (books: readonly ExternalBook[], query: string): ExternalBook[] =>
  [...books].sort((a, b) => score(b, query) - score(a, query));

/**
 * Merge the result sets into one answer for `query`.
 *
 * Order matters on the way in: `searchQueries` puts the plain query first, so
 * that when nothing matches by name the reader still sees Google's own ranking
 * rather than the leftovers of a field query that found nothing.
 */
export const mergeSearchResults = (
  resultSets: readonly (readonly ExternalBook[])[],
  query: string,
  limit: number,
): ExternalBook[] => rankByRelevance(dedupeBySource(resultSets.flat()), query).slice(0, limit);
