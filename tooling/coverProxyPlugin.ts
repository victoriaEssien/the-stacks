import type { Plugin } from 'vite';
import { COVER_PROXY_PATH } from '../src/services/books/covers.ts';
import { handleCoverRequest } from '../src/services/books/coverProxy.ts';

/**
 * Serves `/api/cover` while `pnpm dev` is running.
 *
 * Vite's dev server knows nothing about Vercel's `api/` directory, so without
 * this the room shows generated covers in development and real ones only once
 * deployed - the worst possible split, because the thing you cannot see locally
 * is the thing you are working on. It mounts the SAME handler the deployed
 * function does, so there is one implementation to get right.
 */
export const coverProxyDev = (): Plugin => ({
  name: 'the-stacks:cover-proxy-dev',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== COVER_PROXY_PATH) {
        next();
        return;
      }

      void (async () => {
        try {
          const response = await handleCoverRequest(new Request(url.href));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          // Buffered rather than streamed: this path is development only, and
          // a cover is measured in kilobytes.
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (cause) {
          server.config.logger.error(`[cover-proxy] ${String(cause)}`);
          res.statusCode = 500;
          res.end();
        }
      })();
    });
  },
});
