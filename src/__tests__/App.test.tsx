import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import type { Book } from '@/models';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSuggestionStore } from '@/stores/suggestionStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * jsdom has no WebGL, so the app routes itself to list mode - which is exactly
 * the fallback path spec section 16 asks for, and it exercises the real stores,
 * the localStorage repository and every panel.
 */
const BOOK: Book = {
  id: 'book_1',
  title: 'A Quiet Inventory',
  authors: ['Someone Else'],
  status: 'read',
  rating: 4,
  thoughts: 'Stayed with me.',
  pageCount: 240,
  source: 'test',
  sourceId: 'test-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  // jsdom cannot make a WebGL context and logs a warning for every attempt.
  // Answering null directly is both quieter and an honest simulation of a
  // browser that cannot run the 3D room.
  HTMLCanvasElement.prototype.getContext = () => null;

  localStorage.clear();
  useLibraryStore.setState({ books: [], loadState: 'idle', error: undefined });
  useSuggestionStore.setState({ suggestions: [], loadState: 'idle', submittedCount: 0 });
  useUiStore.setState({ overlay: 'none', selectedBookId: undefined, viewMode: 'explore' });
});

afterEach(() => localStorage.clear());

describe('App', () => {
  it('shows the library once storage has been read', async () => {
    localStorage.setItem('the-stacks:books:v1', JSON.stringify([BOOK]));

    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('Opening the library');

    expect(await screen.findByText('A Quiet Inventory')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'The Stacks' })).toBeTruthy();
    expect(screen.getByText('1 book read')).toBeTruthy();
  });

  it('offers an empty state when there is nothing on the shelves', async () => {
    render(<App />);
    expect(await screen.findByText('No books yet')).toBeTruthy();
    expect(screen.getByText('The shelves are waiting')).toBeTruthy();
  });

  it('opens a book, shows what was written about it, and closes again', async () => {
    localStorage.setItem('the-stacks:books:v1', JSON.stringify([BOOK]));

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /A Quiet Inventory/i }));

    const panel = await screen.findByRole('dialog');
    expect(panel.textContent).toContain('Stayed with me.');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('persists a submitted suggestion', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /Suggestions/ }));
    fireEvent.change(screen.getByLabelText(/Book title/i), {
      target: { value: 'Something borrowed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit suggestion/i }));

    expect(await screen.findByText('Something borrowed')).toBeTruthy();
    await waitFor(() =>
      expect(localStorage.getItem('the-stacks:suggestions:v1')).toContain('Something borrowed'),
    );
  });

  it('explains the controls from the help panel', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'How this works' }));
    expect(screen.getByRole('dialog').textContent).toContain('W A S D');
  });
});
