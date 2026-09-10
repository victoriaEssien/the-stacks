import { create } from 'zustand';
import type { NewSuggestion, Suggestion, SuggestionStatus } from '@/models';
import { suggestionRepository } from '@/services/persistence';
import { createId, nowIso } from '@/utils/id';
import type { AppError } from '@/utils/result';

interface SuggestionState {
  suggestions: Suggestion[];
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  error?: AppError;
  /** Incremented on every successful submission, so the 3D box can post a note. */
  submittedCount: number;

  load: () => Promise<void>;
  addSuggestion: (input: NewSuggestion) => Promise<Suggestion | undefined>;
  setStatus: (id: string, status: SuggestionStatus) => Promise<void>;
  removeSuggestion: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  suggestions: [],
  loadState: 'idle',
  submittedCount: 0,

  load: async () => {
    set({ loadState: 'loading', error: undefined });
    const result = await suggestionRepository.list();
    if (!result.ok) {
      set({ loadState: 'error', error: result.error });
      return;
    }
    set({ suggestions: result.value, loadState: 'ready' });
  },

  addSuggestion: async (input) => {
    const suggestion: Suggestion = {
      ...input,
      id: createId('sug'),
      status: 'unread',
      createdAt: nowIso(),
    };

    const result = await suggestionRepository.save(suggestion);
    if (!result.ok) {
      set({ error: result.error });
      return undefined;
    }

    set((state) => ({
      suggestions: [suggestion, ...state.suggestions],
      submittedCount: state.submittedCount + 1,
      error: undefined,
    }));
    return suggestion;
  },

  setStatus: async (id, status) => {
    const current = get().suggestions.find((item) => item.id === id);
    if (!current) return;

    const next: Suggestion = { ...current, status };
    set((state) => ({
      suggestions: state.suggestions.map((item) => (item.id === id ? next : item)),
    }));

    const result = await suggestionRepository.save(next);
    if (!result.ok) {
      set((state) => ({
        suggestions: state.suggestions.map((item) => (item.id === id ? current : item)),
        error: result.error,
      }));
    }
  },

  removeSuggestion: async (id) => {
    const snapshot = get().suggestions;
    set({ suggestions: snapshot.filter((item) => item.id !== id) });

    const result = await suggestionRepository.remove(id);
    if (!result.ok) set({ suggestions: snapshot, error: result.error });
  },

  clearError: () => set({ error: undefined }),
}));

export const selectUnreadCount = (state: SuggestionState): number =>
  state.suggestions.filter((item) => item.status === 'unread').length;
