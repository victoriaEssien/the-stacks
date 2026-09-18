/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { apiDevPlugin } from './tooling/apiDevPlugin.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // three.js alone is ~700 kB; the default 500 kB warning is just noise here.
    chunkSizeWarningLimit: 900,
    // three.js is large; split it out so app code can be re-cached on its own.
    // Vite 8 bundles with Rolldown, hence `codeSplitting` rather than the old
    // Rollup `manualChunks`.
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            // The Neon SDK moves on its own release cycle, not with app code,
            // so it earns its own long-lived chunk rather than invalidating the
            // app bundle every time a component changes.
            { name: 'neon', test: /[\\/]node_modules[\\/](@neondatabase|zod)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      // Pinned, because Vitest loads .env.local the same way the dev server
      // does. Without this the suite reaches for whatever database the person
      // running it happens to have configured, and `App.test.tsx` - which
      // seeds localStorage - quietly tests nothing. Unit tests talk to no
      // network; the Neon path is covered by injecting a fake client.
      VITE_NEON_URL: '',
    },
  },
});
