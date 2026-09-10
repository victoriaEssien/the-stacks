/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_BOOKS_API_KEY?: string;
  readonly VITE_BOOK_PROVIDER?: 'google' | 'openlibrary';
  readonly VITE_STORAGE_NAMESPACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
