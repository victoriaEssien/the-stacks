import { useEffect } from 'react';

/** The fragment that opens the owner sign-in form. */
export const SIGN_IN_HASH = '#signin';

/**
 * The owner's way in, with nothing on screen to advertise it.
 *
 * A personal library has one account, so a visible "Sign in" is clutter on a
 * page where nobody else has anything to sign in to. This is not a security
 * measure and is not treated as one: the password and Row-Level Security are
 * what protect the library, and anyone who guesses the fragment finds only a
 * password form, exactly as they would on any login page.
 *
 * The fragment is stripped once it has been acted on, so a reload or a shared
 * link does not keep reopening the form.
 */
export const useSignInHash = (onRequest: () => void) => {
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== SIGN_IN_HASH) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);
      onRequest();
    };

    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [onRequest]);
};
