import { create } from 'zustand';
import {
  authAvailable,
  currentSession,
  requestSignInCode,
  signInWithCode,
  signOut,
  type OwnerSession,
} from '@/services/neon';
import type { AppError } from '@/utils/result';

interface AuthState {
  session?: OwnerSession;
  /** `idle` until the stored session has been looked for. */
  loadState: 'idle' | 'loading' | 'ready';
  busy: boolean;
  error?: AppError;
  /** True once a code has been sent, so the form asks for it. */
  codeSent: boolean;

  restore: () => Promise<void>;
  requestCode: (email: string) => Promise<boolean>;
  submitCode: (email: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  reset: () => void;
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
  codeSent: false,

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

  requestCode: async (email) => {
    set({ busy: true, error: undefined });
    const result = await requestSignInCode(email);
    if (!result.ok) {
      set({ busy: false, error: result.error });
      return false;
    }
    set({ busy: false, codeSent: true });
    return true;
  },

  submitCode: async (email, code) => {
    set({ busy: true, error: undefined });
    const result = await signInWithCode(email, code);
    if (!result.ok) {
      set({ busy: false, error: result.error });
      return false;
    }
    set({ session: result.value, busy: false, loadState: 'ready', codeSent: false });
    return true;
  },

  signOut: async () => {
    set({ busy: true });
    await signOut();
    set({ session: undefined, busy: false, error: undefined, codeSent: false });
  },

  reset: () => set({ codeSent: false, error: undefined, busy: false }),

  clearError: () => set({ error: undefined }),
}));

/** True when the interface should offer the controls that change the library. */
export const selectCanEdit = (state: AuthState): boolean =>
  !authAvailable() || state.session !== undefined;
