/**
 * GET /api/search?q=<query> | ?id=<volume id> - Google Books, keyed.
 *
 * `GOOGLE_BOOKS_API_KEY` has NO `VITE_` prefix, which is the whole point: it is
 * read here, on the server, and never reaches the bundle. See
 * `src/services/books/searchProxy.ts` for why this endpoint exists.
 */

import { respondWithSearch } from '../src/services/books/searchProxy.ts';

export default {
  fetch: (request: Request): Promise<Response> =>
    respondWithSearch(request, { apiKey: process.env.GOOGLE_BOOKS_API_KEY }),
};
