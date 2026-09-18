import { describe, expect, it, vi } from 'vitest';
import type { FetchLike } from '../coverProxy';
import { handleCoverRequest, respondWithCover } from '../coverProxy';

const PIXEL = 'not really a jpeg, but bytes all the same';

const imageResponse = (init: { type?: string; length?: number; status?: number } = {}) =>
  new Response(PIXEL, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': init.type ?? 'image/jpeg',
      ...(init.length === undefined ? {} : { 'Content-Length': String(init.length) }),
    },
  });

/** Typed as `FetchLike` so the recorded calls keep the real argument shape. */
const stubFetch = (response: Response | (() => Promise<Response>)) =>
  vi.fn<FetchLike>(typeof response === 'function' ? response : () => Promise.resolve(response));

describe('respondWithCover', () => {
  it('re-serves the upstream bytes with the header WebGL needs', async () => {
    const fetchImpl = stubFetch(imageResponse());
    const response = await respondWithCover('https://books.google.com/x.jpg', fetchImpl);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe(PIXEL);
  });

  it('lets the browser and the CDN hold on to a cover', async () => {
    const response = await respondWithCover(
      'https://books.google.com/x.jpg',
      stubFetch(imageResponse()),
    );
    const cache = response.headers.get('cache-control') ?? '';
    expect(cache).toContain('public');
    expect(cache).toContain('s-maxage=31536000');
  });

  it('follows the redirects Open Library answers with', async () => {
    const fetchImpl = stubFetch(imageResponse());
    await respondWithCover('https://covers.openlibrary.org/b/isbn/9780000000001-L.jpg', fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe('follow');
  });

  it('fetches over https even when handed http', async () => {
    const fetchImpl = stubFetch(imageResponse());
    await respondWithCover('http://books.google.com/x.jpg', fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://books.google.com/x.jpg');
  });

  it('asks for nothing at all when there is no src', async () => {
    const fetchImpl = stubFetch(imageResponse());
    expect((await respondWithCover(null, fetchImpl)).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a src it should not reach, without making the request', async () => {
    const fetchImpl = stubFetch(imageResponse());
    for (const src of [
      'https://169.254.169.254/latest',
      'https://localhost/x',
      'file:///etc/hosts',
    ]) {
      expect((await respondWithCover(src, fetchImpl)).status, src).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes a missing cover through as a 404, since that is what it is', async () => {
    const response = await respondWithCover(
      'https://covers.openlibrary.org/b/isbn/9780000000001-L.jpg',
      stubFetch(new Response('not found', { status: 404 })),
    );
    expect(response.status).toBe(404);
  });

  it('reports an upstream fault as a gateway error, not as a missing cover', async () => {
    const response = await respondWithCover(
      'https://books.google.com/x.jpg',
      stubFetch(new Response('boom', { status: 500 })),
    );
    expect(response.status).toBe(502);
  });

  it('refuses to hand back something that is not an image', async () => {
    const response = await respondWithCover(
      'https://example.com/login.html',
      stubFetch(imageResponse({ type: 'text/html' })),
    );
    expect(response.status).toBe(502);
  });

  it('refuses an image far too large to be cover art', async () => {
    const response = await respondWithCover(
      'https://example.com/huge.jpg',
      stubFetch(imageResponse({ length: 40 * 1024 * 1024 })),
    );
    expect(response.status).toBe(502);
  });

  it('serves a cover that declares a sane length', async () => {
    const response = await respondWithCover(
      'https://example.com/cover.jpg',
      stubFetch(imageResponse({ length: PIXEL.length })),
    );
    expect(response.status).toBe(200);
  });

  it('turns an unreachable host into a gateway error rather than throwing', async () => {
    const response = await respondWithCover(
      'https://books.google.com/x.jpg',
      stubFetch(() => Promise.reject(new Error('ENOTFOUND'))),
    );
    expect(response.status).toBe(502);
  });

  it('never caches a refusal', async () => {
    const response = await respondWithCover(null, stubFetch(imageResponse()));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('handleCoverRequest', () => {
  it('reads the cover to fetch out of the query string', async () => {
    const src = 'https://books.google.com/books/content?id=abc&img=1';
    const fetchImpl = stubFetch(imageResponse());
    const request = new Request(`https://stacks.example/api/cover?src=${encodeURIComponent(src)}`);

    const response = await handleCoverRequest(request, fetchImpl);

    expect(response.status).toBe(200);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(src);
  });

  it('refuses a request with no src', async () => {
    const response = await handleCoverRequest(
      new Request('https://stacks.example/api/cover'),
      stubFetch(imageResponse()),
    );
    expect(response.status).toBe(400);
  });
});
