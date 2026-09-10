import { render } from '@testing-library/react';
import { useShallow } from 'zustand/react/shallow';
import { expect, it } from 'vitest';
import { selectShelvedBooks, useLibraryStore } from '@/stores/libraryStore';
import type { Book } from '@/models';

const book = (id: string, status: Book['status']): Book => ({
  id,
  title: id,
  authors: ['A'],
  source: 'test',
  sourceId: id,
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

it('does not re-render forever on a derived array selector', () => {
  useLibraryStore.setState({ books: [book('b1', 'read'), book('b2', 'reading')] });

  let renders = 0;
  const Probe = () => {
    renders += 1;
    const shelved = useLibraryStore(useShallow(selectShelvedBooks));
    return <span>{shelved.length}</span>;
  };

  const { getByText } = render(<Probe />);
  expect(getByText('1')).toBeTruthy();
  expect(renders).toBeLessThan(5);
});
