import { loadEnv, type Plugin } from 'vite';
import { COVER_PROXY_PATH, SEARCH_PROXY_PATH } from '../src/services/books/endpoints.ts';
import { handleCoverRequest } from '../src/services/books/coverProxy.ts';
import { respondWithSearch } from '../src/services/books/searchProxy.ts';

/**
 * Serves the `api/` endpoints while `pnpm dev` is running.
 *
 * Vite's dev server knows nothing about Vercel's `api/` directory, so without
 * this the room shows generated covers and searches fail in development, while
 * both work once deployed - the worst possible split, because the thing you
 * cannot see locally is the thing you are working on. It mounts the SAME
 * handlers the deployed functions do, so there is one implementation to get
 * right rather than one that is tested and one that ships.
 */
const ROUTES: Record<string, (request: Request, apiKey?: string) => Promise<Response>> = {
  [COVER_PROXY_PATH]: (request) => handleCoverRequest(request),
  [SEARCH_PROXY_PATH]: (request, apiKey) => respondWithSearch(request, { apiKey }),
};

export const apiDevPlugin = (): Plugin => {
  let apiKey: string | undefined;

  return {
    name: 'the-stacks:api-dev',

    configResolved(config) {
      // An empty prefix loads UNPREFIXED variables too, which is the whole
      // point: the Google key must not be a `VITE_` one, so Vite would not
      // otherwise expose it, and the dev server has to read it the way the
      // deployed function reads `process.env`.
      const loaded = loadEnv(config.mode, config.envDir, '');
      apiKey = loaded.GOOGLE_BOOKS_API_KEY?.trim() || undefined;

      if (!apiKey) {
        config.logger.warn(
          '[api-dev] GOOGLE_BOOKS_API_KEY is not set, so /api/search will ask ' +
            'Google unkeyed and be rate limited by IP.',
        );
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // The real host, so that the same-origin check in `callerOrigin` sees
        // what it would see in production.
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const route = ROUTES[url.pathname];
        if (!route) {
          next();
          return;
        }

        void (async () => {
          try {
            // Node does not enforce the fetch spec's forbidden header names,
            // so `referer` and `sec-fetch-site` survive and the handler sees
            // the browser's own values.
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers.set(name, value);
            }

            const response = await route(new Request(url.href, { headers }), apiKey);
            res.statusCode = response.status;
            response.headers.forEach((value, name) => res.setHeader(name, value));
            // Buffered rather than streamed: development only, and a cover is
            // measured in kilobytes.
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (cause) {
            server.config.logger.error(`[api-dev] ${url.pathname}: ${String(cause)}`);
            res.statusCode = 500;
            res.end();
          }
        })();
      });
    },
  };
};
