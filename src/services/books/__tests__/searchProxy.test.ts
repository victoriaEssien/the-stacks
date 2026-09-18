import { describe, expect, it, vi } from 'vitest';
import type { FetchLike } from '../apiResponse';
import { SEARCH_PROXY_PATH } from '../endpoints';
import { respondWithSearch } from '../searchProxy';

const SITE = 'stacks.example';
const VOLUMES = { totalItems: 1, items: [{ id: 'abc', volumeInfo: { title: 'A Book' } }] };

const jsonResponse = (body: unknown = VOLUMES, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const stubFetch = (response: Response | (() => Promise<Response>)) =>
  vi.fn<FetchLike>(typeof response === 'function' ? response : () => Promise.resolve(response));

/** A request as the app's own page would make it. */
const fromOurPage = (query: string, headers: Record<string, string> = {}) =>
  new Request(`https://${SITE}${SEARCH_PROXY_PATH}${query}`, {
    headers: {
      host: SITE,
      referer: `https://${SITE}/`,
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
  });

const calledUrl = (fetchImpl: ReturnType<typeof stubFetch>) =>
  new URL(fetchImpl.mock.calls[0]?.[0] ?? 'https://x.invalid');

describe('respondWithSearch', () => {
  it('asks Google for the query and hands back its JSON untouched', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    const response = await respondWithSearch(fromOurPage('?q=a+book'), { fetchImpl });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(VOLUMES);

    const asked = calledUrl(fetchImpl);
    expect(asked.host).toBe('www.googleapis.com');
    expect(asked.searchParams.get('q')).toBe('a book');
    expect(asked.searchParams.get('printType')).toBe('books');
  });

  it('adds the key the browser is no longer allowed to have', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    await respondWithSearch(fromOurPage('?q=a+book'), { fetchImpl, apiKey: 'secret-key' });
    expect(calledUrl(fetchImpl).searchParams.get('key')).toBe('secret-key');
  });

  it('asks unkeyed rather than failing when no key is configured', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    const response = await respondWithSearch(fromOurPage('?q=a+book'), { fetchImpl });
    expect(response.status).toBe(200);
    expect(calledUrl(fetchImpl).searchParams.has('key')).toBe(false);
  });

  it('tells Google which of our pages asked, so a restricted key still works', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    await respondWithSearch(fromOurPage('?q=a+book'), { fetchImpl });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Referer: `https://${SITE}/`,
    });
  });

  it('lets the CDN keep a result, which is what makes a repeat search free', async () => {
    const response = await respondWithSearch(fromOurPage('?q=a+book'), {
      fetchImpl: stubFetch(jsonResponse()),
    });
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('looks up a single volume by id', async () => {
    const fetchImpl = stubFetch(jsonResponse({ id: 'abc' }));
    await respondWithSearch(fromOurPage('?id=abc123'), { fetchImpl });
    expect(calledUrl(fetchImpl).pathname).toBe('/books/v1/volumes/abc123');
  });

  it('refuses an id that is not one, rather than building a path from it', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    for (const id of ['../../secret', 'a b', 'x'.repeat(65)]) {
      const response = await respondWithSearch(fromOurPage(`?id=${encodeURIComponent(id)}`), {
        fetchImpl,
      });
      expect(response.status, id).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('needs a query or an id', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    expect((await respondWithSearch(fromOurPage(''), { fetchImpl })).status).toBe(400);
    expect((await respondWithSearch(fromOurPage('?q=++'), { fetchImpl })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a query too long to be a book search', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    const response = await respondWithSearch(fromOurPage(`?q=${'a'.repeat(201)}`), { fetchImpl });
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('caps how many results can be asked for, and defaults to a page', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    await respondWithSearch(fromOurPage('?q=a&maxResults=500'), { fetchImpl });
    expect(calledUrl(fetchImpl).searchParams.get('maxResults')).toBe('40');

    const second = stubFetch(jsonResponse());
    await respondWithSearch(fromOurPage('?q=a'), { fetchImpl: second });
    expect(calledUrl(second).searchParams.get('maxResults')).toBe('12');
  });

  it('forwards no parameter it was not asked for', async () => {
    const fetchImpl = stubFetch(jsonResponse());
    await respondWithSearch(fromOurPage('?q=a&country=ZZ&fields=items'), { fetchImpl });
    const asked = calledUrl(fetchImpl);
    expect(asked.searchParams.has('country')).toBe(false);
    expect(asked.searchParams.has('fields')).toBe(false);
  });

  describe('who is allowed to spend our quota', () => {
    it('serves our own page', async () => {
      const response = await respondWithSearch(fromOurPage('?q=a'), {
        fetchImpl: stubFetch(jsonResponse()),
      });
      expect(response.status).toBe(200);
    });

    it('refuses another site, without spending a request', async () => {
      const fetchImpl = stubFetch(jsonResponse());
      const response = await respondWithSearch(
        fromOurPage('?q=a', { 'sec-fetch-site': 'cross-site', referer: 'https://evil.test/' }),
        { fetchImpl },
      );
      expect(response.status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses a referer from elsewhere even when the fetch metadata looks right', async () => {
      const response = await respondWithSearch(
        fromOurPage('?q=a', { referer: 'https://evil.test/page' }),
        { fetchImpl: stubFetch(jsonResponse()) },
      );
      expect(response.status).toBe(403);
    });

    it('refuses a bare request, which is what a scraper sends', async () => {
      const bare = new Request(`https://${SITE}${SEARCH_PROXY_PATH}?q=a`, {
        headers: { host: SITE },
      });
      const response = await respondWithSearch(bare, { fetchImpl: stubFetch(jsonResponse()) });
      expect(response.status).toBe(403);
    });

    it('serves a browser too old to send fetch metadata, on the referer alone', async () => {
      const older = new Request(`https://${SITE}${SEARCH_PROXY_PATH}?q=a`, {
        headers: { host: SITE, referer: `https://${SITE}/library` },
      });
      const response = await respondWithSearch(older, { fetchImpl: stubFetch(jsonResponse()) });
      expect(response.status).toBe(200);
    });

    it('trusts the forwarded host, since a proxy rewrites the one on the url', async () => {
      const proxied = new Request(`http://internal-10-0-0-1${SEARCH_PROXY_PATH}?q=a`, {
        headers: {
          host: 'internal-10-0-0-1',
          'x-forwarded-host': SITE,
          referer: `https://${SITE}/`,
          'sec-fetch-site': 'same-origin',
        },
      });
      const response = await respondWithSearch(proxied, { fetchImpl: stubFetch(jsonResponse()) });
      expect(response.status).toBe(200);
    });
  });

  describe('when Google says no', () => {
    it('passes a rate limit through, so the client can fall back', async () => {
      const response = await respondWithSearch(fromOurPage('?q=a'), {
        fetchImpl: stubFetch(jsonResponse({ error: 'slow down' }, 429)),
      });
      expect(response.status).toBe(429);
    });

    it('passes a refused key through as a 403', async () => {
      const response = await respondWithSearch(fromOurPage('?q=a'), {
        fetchImpl: stubFetch(jsonResponse({ error: 'API key not valid' }, 403)),
      });
      expect(response.status).toBe(403);
    });

    it('never repeats the error body, which quotes the key back', async () => {
      const response = await respondWithSearch(fromOurPage('?q=a'), {
        fetchImpl: stubFetch(jsonResponse({ error: 'API key not valid: secret-key' }, 400)),
      });
      expect(await response.text()).not.toContain('secret-key');
    });

    it('turns an unreachable service into a gateway error', async () => {
      const response = await respondWithSearch(fromOurPage('?q=a'), {
        fetchImpl: stubFetch(() => Promise.reject(new Error('ETIMEDOUT'))),
      });
      expect(response.status).toBe(502);
    });

    it('never caches a refusal', async () => {
      const response = await respondWithSearch(fromOurPage(''), {
        fetchImpl: stubFetch(jsonResponse()),
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
    });
  });
});
