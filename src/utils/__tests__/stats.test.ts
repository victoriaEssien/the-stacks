import { describe, expect, it } from 'vitest';
import type { Book } from '@/models';
import { computeStats } from '../stats';

const book = (overrides: Partial<Book>): Book => ({
  id: overrides.id ?? 'id',
  title: 'A Book',
  authors: ['An Author'],
  status: 'read',
  source: 'test',
  sourceId: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('computeStats', () => {
  it('counts only read books on the shelf tally', () => {
    const stats = computeStats([
      book({ id: '1' }),
      book({ id: '2', status: 'reading' }),
      book({ id: '3', status: 'want_to_read' }),
    ]);
    expect(stats.booksRead).toBe(1);
    expect(stats.currentlyReading).toHaveLength(1);
    expect(stats.wantToRead).toBe(1);
  });

  it('averages ratings only across rated books', () => {
    const stats = computeStats([
      book({ id: '1', rating: 5 }),
      book({ id: '2', rating: 4 }),
      book({ id: '3' }),
    ]);
    expect(stats.averageRating).toBe(4.5);
  });

  it('leaves the average undefined when nothing is rated', () => {
    expect(computeStats([book({ id: '1' })]).averageRating).toBeUndefined();
  });

  it('counts books finished in the current year', () => {
    const stats = computeStats(
      [
        book({ id: '1', dateFinished: '2026-03-04' }),
        book({ id: '2', dateFinished: '2024-03-04' }),
      ],
      new Date('2026-09-01'),
    );
    expect(stats.booksThisYear).toBe(1);
  });
});
