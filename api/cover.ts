/**
 * GET /api/cover?src=<https url> - the same cover, from our own origin.
 *
 * Vercel picks this up with no configuration; `export default { fetch }` is the
 * Web-standard signature its Node runtime expects. TypeScript path aliases are
 * NOT supported inside `api/`, hence the relative import.
 *
 * The behaviour lives in the books service so that the Vite dev server can
 * mount exactly the same handler - see `vite/coverProxyPlugin.ts`. Without that
 * there would be two implementations and only one of them would be tested.
 */

import { handleCoverRequest } from '../src/services/books/coverProxy.ts';

export default {
  fetch: (request: Request): Promise<Response> => handleCoverRequest(request),
};
