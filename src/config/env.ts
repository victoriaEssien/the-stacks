/**
 * Single place where `import.meta.env` is read. Everything else imports `env`
 * so that swapping in a server-side config later touches exactly one file.
 */
export type ProviderId = 'google' | 'openlibrary';

export const env = {
  googleBooksApiKey: import.meta.env.VITE_GOOGLE_BOOKS_API_KEY?.trim() || undefined,
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
  preferredProvider: (import.meta.env.VITE_BOOK_PROVIDER ?? 'google') as ProviderId,
  storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE ?? 'the-stacks',
  isDev: import.meta.env.DEV,
} as const;
