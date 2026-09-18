/**
 * Shared plumbing for the endpoints under `api/`.
 *
 * Kept in the books service because both endpoints exist to talk to book
 * providers, and because the dev server mounts the same handlers - see
 * `tooling/apiDevPlugin.ts`.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Every refusal is a plain status with a one line reason. Callers treat all of
 * them the same way, so the codes and the text are for whoever is reading the
 * network tab, not for the app.
 */
export const refuse = (status: number, reason: string): Response =>
  new Response(reason, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/**
 * The origin of the page that made this request, or `undefined` when it did
 * not come from one of our own pages.
 *
 * This is a DETERRENT, not a security boundary: `Referer` and `Sec-Fetch-Site`
 * both come from the caller and a script can send whatever it likes. It is here
 * because `/api/search` spends our Google Books quota, and without it the
 * endpoint is a keyless Google Books API that anyone who reads the page source
 * can point a scraper at. Browsers send these honestly, so it stops all of the
 * casual version of that, which is the only version that was going to happen.
 *
 * Both headers are consulted because neither is universal: Safari only learned
 * `Sec-Fetch-Site` in 16.4, and `Referer` can be stripped by an extension. When
 * a signal is present it must agree; when none is, the request is refused.
 */
export const callerOrigin = (request: Request): string | undefined => {
  const site = request.headers.get('sec-fetch-site');
  // `same-origin` for our own fetch. `cross-site`, `same-site` and `none`
  // (typed into the address bar) are all somebody else.
  if (site !== null && site !== 'same-origin') return undefined;

  const referer = request.headers.get('referer');
  if (referer === null) return undefined;

  try {
    const url = new URL(referer);
    // Compared by HOST rather than by full origin, and from whichever source
    // has it: behind a proxy `request.url` can carry an internal scheme and
    // host, while the forwarded headers carry what the browser actually asked
    // for. Any one of them matching is enough.
    const expected = [
      request.headers.get('x-forwarded-host'),
      request.headers.get('host'),
      new URL(request.url).host,
    ].filter((host): host is string => host !== null && host.length > 0);

    return expected.includes(url.host) ? url.origin : undefined;
  } catch {
    return undefined;
  }
};
