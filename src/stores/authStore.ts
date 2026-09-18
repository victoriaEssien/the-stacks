import { create } from 'zustand';
import { authAvailable, currentSession, signIn, signOut, type OwnerSession } from '@/services/neon';
import type { AppError } from '@/utils/result';

interface AuthState {
  session?: OwnerSession;
  /** `idle` until the stored session has been looked for. */
  loadState: 'idle' | 'loading' | 'ready';
  busy: boolean;
  error?: AppError;

  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/**
 * Who is allowed to change the library.
 *
 * `canEdit` is the question the UI actually asks, and it is true on
 * localStorage because there is no database to be the owner of - the reader is
 * simply looking at their own browser. When the library IS backed by Neon,
 * editing needs a session. This only decides what to SHOW: the real guard is
 * Row-Level Security, which refuses a write from anyone but the owner however
 * the interface is persuaded to offer it.
 */
export const useAuthStore = create<AuthState>((set) => ({
  loadState: 'idle',
  busy: false,

  restore: async () => {
    set({ loadState: 'loading' });
    const result = await currentSession();
    set({
      session: result.ok ? result.value : undefined,
      loadState: 'ready',
      // A failure to reach the sign-in service is not worth shouting about on
      // load: the visitor path needs no session at all.
      error: undefined,
    });
  },

  signIn: async (email, password) => {
    set({ busy: true, error: undefined });
    const result = await signIn(email, password);
    if (!result.ok) {
      set({ busy: false, error: result.error });
      return false;
    }
    set({ session: result.value, busy: false, loadState: 'ready' });
    return true;
  },

  signOut: async () => {
    set({ busy: true });
    await signOut();
    set({ session: undefined, busy: false, error: undefined });
  },

  clearError: () => set({ error: undefined }),
}));

/** True when the interface should offer the controls that change the library. */
export const selectCanEdit = (state: AuthState): boolean =>
  !authAvailable() || state.session !== undefined;
