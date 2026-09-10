import { useEffect } from 'react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSuggestionStore } from '@/stores/suggestionStore';

/** Loads persisted books and suggestions once, on mount. */
export const useLibraryBootstrap = () => {
  const loadBooks = useLibraryStore((state) => state.load);
  const loadSuggestions = useSuggestionStore((state) => state.load);
  const loadState = useLibraryStore((state) => state.loadState);

  useEffect(() => {
    void loadBooks();
    void loadSuggestions();
  }, [loadBooks, loadSuggestions]);

  return loadState;
};
