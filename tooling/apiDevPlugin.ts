import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Serves the `api/` endpoints while `pnpm dev` is running.
 *
 * Vite's dev server knows nothing about Vercel's `api/` directory, so without
 * this the room shows generated covers and searches fail in development, while
 * both work once deployed - the worst possible split, because the thing you
 * cannot see locally is the thing you are working on. It runs the SAME handlers
 * the deployed functions do, so there is one implementation to get right rather
 * than one that is tested and one that ships.
 *
 * The handlers are loaded through `ssrLoadModule` rather than imported, and
 * that is deliberate. Their imports name the COMPILED file (`./covers.js` for
 * `covers.ts`), because Vercel transpiles each function file on its own and
 * leaves the specifier alone - a `.ts` specifier then points at a file that no
 * longer exists, which is exactly how this broke in production the first time.
 * Vite resolves those specifiers happily; Node, which is what will load this
 * config once Vite's native config loader becomes the default, would not. So
 * nothing under `src/` is in this file's static import graph, and the only
 * dependency on it is a type.
 */

// Type only, so they erase completely and leave no runtime import behind.
import type * as EndpointsModule from '../src/services/books/endpoints.ts';
import type * as CoverProxyModule from '../src/services/books/coverProxy.ts';
import type * as SearchProxyModule from '../src/services/books/searchProxy.ts';

const ENDPOINTS = '/src/services/books/endpoints.ts';
const COVER = '/src/services/books/coverProxy.ts';
const SEARCH = '/src/services/books/searchProxy.ts';

type Endpoints = typeof EndpointsModule;
type CoverProxy = typeof CoverProxyModule;
type SearchProxy = typeof SearchProxyModule;

const load = async <T>(server: ViteDevServer, id: string): Promise<T> =>
  (await server.ssrLoadModule(id)) as unknown as T;

/** The handler for this path, run against this request. */
const dispatch = async (
  server: ViteDevServer,
  request: Request,
  pathname: string,
  apiKey: string | undefined,
): Promise<Response | undefined> => {
  const { COVER_PROXY_PATH, SEARCH_PROXY_PATH } = await load<Endpoints>(server, ENDPOINTS);

  if (pathname === COVER_PROXY_PATH) {
    const { handleCoverRequest } = await load<CoverProxy>(server, COVER);
    return handleCoverRequest(request);
  }

  if (pathname === SEARCH_PROXY_PATH) {
    const { respondWithSearch } = await load<SearchProxy>(server, SEARCH);
    return respondWithSearch(request, { apiKey });
  }

  return undefined;
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
        if (!url.pathname.startsWith('/api/')) {
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

            const response = await dispatch(
              server,
              new Request(url.href, { headers }),
              url.pathname,
              apiKey,
            );
            if (!response) {
              next();
              return;
            }

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
