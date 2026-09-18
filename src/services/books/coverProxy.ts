/**
 * The cover endpoint's behaviour, written once and served twice.
 *
 * `api/cover.ts` is the deployed function; the Vite dev server mounts the same
 * handler as middleware so `pnpm dev` behaves like production. Nothing in the
 * browser bundle imports this file - the client only wants `proxiedCoverUrl`.
 *
 * It takes Web-standard `Request`/`Response` because that is what Vercel's Node
 * runtime hands a function, and because it makes the whole thing testable with
 * an injected `fetch` and no server at all.
 */

import { proxyableCoverUrl } from './covers.ts';

/** Covers run to tens of kilobytes. Anything this big is not cover art. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Open Library answers through two redirects to archive.org; allow for that. */
const UPSTREAM_TIMEOUT_MS = 8_000;

/**
 * A cover at a given URL never changes, so the browser may hold it for a day
 * and the CDN effectively forever - which is the point of having our own
 * endpoint at all: the second visitor's texture costs no upstream request.
 */
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800';

/**
 * Every refusal is a plain status with no body worth reading. The caller's next
 * move is the same in all cases - try the next candidate, then draw a cover -
 * so the codes are for whoever is reading the network tab, not for the app.
 */
const refuse = (status: number, reason: string): Response =>
  new Response(reason, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Fetches one cover and re-serves its bytes from this origin. */
export const respondWithCover = async (
  src: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<Response> => {
  if (!src) return refuse(400, 'Pass the cover to fetch as ?src=');

  const upstream = proxyableCoverUrl(src);
  if (!upstream) return refuse(400, 'That src is not a fetchable cover URL.');

  let response: Response;
  try {
    response = await fetchImpl(upstream.href, {
      // Open Library hands off to archive.org, so redirects must be followed.
      // The hop targets are chosen by the upstream host, not by the caller, so
      // this does not widen what `proxyableCoverUrl` just decided.
      redirect: 'follow',
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return refuse(502, 'Could not reach that cover host.');
  }

  // 404 is the ordinary answer for a book nobody has scanned, and it is worth
  // passing through as itself rather than flattening into a server error.
  if (!response.ok) return refuse(response.status === 404 ? 404 : 502, 'No cover there.');

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) return refuse(502, 'That URL is not an image.');

  // Only advisory: a chunked response declares no length. The timeout is the
  // real backstop, and every cover host measured so far sends a length.
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return refuse(502, 'That image is too large to be a cover.');
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': CACHE_CONTROL,
      // The app is served from this same origin, so this is belt and braces.
      // It stays because a missing CORS header is the exact fault this endpoint
      // exists to remove, and WebGL reports it as an unexplained blank book.
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

/** Pulls `?src=` off a request and answers it. */
export const handleCoverRequest = (request: Request, fetchImpl?: FetchLike): Promise<Response> =>
  respondWithCover(new URL(request.url).searchParams.get('src'), fetchImpl);
