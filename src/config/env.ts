/**
 * Single place where `import.meta.env` is read. Everything else imports `env`
 * so that swapping in a server-side config later touches exactly one file.
 */
export type ProviderId = 'google' | 'openlibrary';

export const env = {
  googleBooksApiKey: import.meta.env.VITE_GOOGLE_BOOKS_API_KEY?.trim() || undefined,
  /**
   * Neon Data API base URL. Public by design - the guard is the GRANTs on the
   * `anonymous` role plus RLS, never obscurity. The Postgres connection string
   * must NEVER appear here; it would hand the whole database to the browser.
   * Unset means the library stays in localStorage.
   */
  neonDataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL?.trim() || undefined,
  preferredProvider: (import.meta.env.VITE_BOOK_PROVIDER ?? 'google') as ProviderId,
  storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE ?? 'the-stacks',
  isDev: import.meta.env.DEV,
} as const;
