/**
 * `/api/search` - book search, with the Google Books key held server side.
 *
 * Why an endpoint rather than calling Google from the browser:
 *
 * - A `VITE_` key is baked into the bundle and is therefore public. Keeping it
 *   here is the difference between a key anyone can lift and a key nobody can,
 *   and it is what the spec's "no secrets in the client" rule actually asks for.
 * - An unkeyed browser client is rate limited by IP, so searches silently fell
 *   through to Open Library and its patchier metadata. One key, used from one
 *   place, is a quota we can reason about.
 * - The HTTP referrer restriction on the key no longer has to be maintained
 *   across localhost, the production domain and every preview URL.
 *
 * It is deliberately a PIPE: Google's own JSON goes back untouched, so
 * `GoogleBooksProvider` keeps the one copy of the normalising code and nothing
 * outside this folder learns a provider's response shape.
 */

import { callerOrigin, refuse, type FetchLike } from './apiResponse.ts';

const GOOGLE_VOLUMES = 'https://www.googleapis.com/books/v1/volumes';

/** Long enough for a title, an author and an ISBN together. */
const MAX_QUERY_LENGTH = 200;

/** Google's own ceiling. */
const MAX_RESULTS = 40;

/** A volume id is an opaque Google token; anything else is not one. */
const VOLUME_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Results for a given query barely change, and the CDN copy is what makes a
 * repeated search cost no quota at all. Short in the browser so that a search
 * typed twice in one session still feels live.
 */
const CACHE_CONTROL = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';

const UPSTREAM_TIMEOUT_MS = 10_000;

export interface SearchProxyOptions {
  /** `GOOGLE_BOOKS_API_KEY`. Absent means we ask unkeyed, as before. */
  apiKey?: string;
  fetchImpl?: FetchLike;
}

/**
 * The Google URL to call for this request, or a refusal.
 *
 * The caller chooses a query or a volume id and nothing else: forwarding
 * arbitrary parameters would make this a general purpose Google Books proxy
 * carrying our key, which is the thing we just stopped shipping.
 */
const upstreamUrl = (params: URLSearchParams, apiKey?: string): URL | Response => {
  const id = params.get('id');
  const query = params.get('q')?.trim();

  let url: URL;
  if (id !== null) {
    if (!VOLUME_ID.test(id)) return refuse(400, 'That is not a volume id.');
    url = new URL(`${GOOGLE_VOLUMES}/${id}`);
  } else if (query) {
    if (query.length > MAX_QUERY_LENGTH) return refuse(400, 'That search is too long.');
    url = new URL(GOOGLE_VOLUMES);
    url.searchParams.set('q', query);
    url.searchParams.set('printType', 'books');

    const requested = Number(params.get('maxResults'));
    const limit =
      Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_RESULTS) : 12;
    url.searchParams.set('maxResults', String(limit));
  } else {
    return refuse(400, 'Pass a search as ?q= or a volume as ?id=');
  }

  if (apiKey) url.searchParams.set('key', apiKey);
  return url;
};

/** Searches Google Books on the caller's behalf and hands back its JSON. */
export const respondWithSearch = async (
  request: Request,
  options: SearchProxyOptions = {},
): Promise<Response> => {
  const origin = callerOrigin(request);
  if (!origin) return refuse(403, 'This endpoint only serves the pages of this site.');

  const url = upstreamUrl(new URL(request.url).searchParams, options.apiKey);
  if (url instanceof Response) return url;

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url.href, {
      headers: {
        Accept: 'application/json',
        // The search really did come from a page on this site, and saying so
        // lets the key keep its HTTP referrer restriction instead of having to
        // be unrestricted now that it is called from a server.
        Referer: `${origin}/`,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return refuse(502, 'Could not reach the book service.');
  }

  if (!response.ok) {
    // The status is passed through on purpose. `fetchJson` in the client turns
    // 429 into a rate limit and 403 into a refused key, and `BookService` falls
    // through to Open Library on either - behaviour that would be lost if every
    // upstream fault became a flat 502. The BODY is not passed through: Google's
    // error JSON quotes the key back at you.
    return refuse(response.status, 'The book service refused the request.');
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    return refuse(502, 'The book service sent nothing back.');
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
