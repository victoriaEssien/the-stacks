import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExternalBook } from '@/models';
import { bookService } from '@/services/books';
import type { AppError } from '@/utils/result';

interface BookSearchState {
  query: string;
  results: ExternalBook[];
  isSearching: boolean;
  error?: AppError;
  /** True once a search has completed at least once for the current query. */
  hasSearched: boolean;
}

const DEBOUNCE_MS = 350;

/**
 * Debounced search against the BookService. Cancels in-flight requests so fast
 * typing never triggers a pile-up of API calls.
 */
export const useBookSearch = () => {
  const [state, setState] = useState<BookSearchState>({
    query: '',
    results: [],
    isSearching: false,
    hasSearched: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, isSearching: true, error: undefined }));
    const result = await bookService.search(query, { signal: controller.signal, limit: 12 });
    if (controller.signal.aborted) return;

    setState((prev) => ({
      ...prev,
      isSearching: false,
      hasSearched: true,
      results: result.ok ? result.value : [],
      error: result.ok ? undefined : result.error,
    }));
  }, []);

  const setQuery = useCallback(
    (query: string) => {
      setState((prev) => ({ ...prev, query }));
      if (timerRef.current) clearTimeout(timerRef.current);

      if (query.trim().length < 2) {
        abortRef.current?.abort();
        setState((prev) => ({
          ...prev,
          query,
          results: [],
          isSearching: false,
          hasSearched: false,
        }));
        return;
      }

      timerRef.current = setTimeout(() => void runSearch(query), DEBOUNCE_MS);
    },
    [runSearch],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ query: '', results: [], isSearching: false, hasSearched: false });
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { ...state, setQuery, reset, searchNow: runSearch };
};
