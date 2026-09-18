/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_NAMESPACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
