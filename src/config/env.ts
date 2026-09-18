/**
 * Single place where `import.meta.env` is read. Everything else imports `env`
 * so that swapping in a server-side config later touches exactly one file.
 */
export type ProviderId = 'google' | 'openlibrary';

export const env = {
  /*
   * There is deliberately no Google Books key here. It lives in
   * `GOOGLE_BOOKS_API_KEY`, with no `VITE_` prefix, and is read by
   * `api/search.ts` on the server - see `services/books/searchProxy.ts`.
   * Anything in this object is inlined into the bundle and therefore public.
   */
  /**
   * Neon project base URL, e.g. `https://ep-xxx.<region>.aws.neon.tech/<db>`.
   * The client derives the Data API and auth hosts from it, so this is the only
   * value needed.
   *
   * Public by design - the guard is the GRANTs on the `anonymous` role plus
   * RLS, never obscurity. The Postgres connection string must NEVER appear in a
   * `VITE_` variable; it would hand the whole database to the browser. Unset
   * means the library stays in localStorage.
   */
  neonUrl: import.meta.env.VITE_NEON_URL?.trim() || undefined,
  /**
   * The owner's auth user id, i.e. what `auth.user_id()` returns for them.
   *
   * Not a secret. It is already the literal inside the RLS policy, and all it
   * does here is decide which controls are worth drawing. Unset means nobody is
   * treated as the owner, which is the safe direction to fail: the buttons
   * disappear rather than appearing for a stranger.
   */
  libraryOwnerId: import.meta.env.VITE_LIBRARY_OWNER_ID?.trim() || undefined,
  preferredProvider: (import.meta.env.VITE_BOOK_PROVIDER ?? 'google') as ProviderId,
  storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE ?? 'the-stacks',
  isDev: import.meta.env.DEV,
} as const;
