/**
 * Where cover art comes from, and how it reaches a WebGL texture.
 *
 * This lives in the books service because it is knowledge about PROVIDERS -
 * their CDNs and the headers they send - which nothing outside this folder is
 * supposed to hold.
 *
 * A plain `<img>` can load any of these URLs directly. WebGL cannot: a texture
 * must come from a CORS-clean image, and Google serves the best jackets with no
 * `Access-Control-Allow-Origin` at all. The room used to work around that by
 * asking Open Library for the same ISBN instead, which meant the same book wore
 * different art in the room than in the panel, and wore none at all when Open
 * Library had no scan behind that ISBN. Now every texture URL is routed through
 * our own `/api/cover`, which re-serves the upstream bytes from this origin. One
 * source of art per book, and the CORS question stops arising.
 */

export const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org/b';

/**
 * `default=false` is load-bearing: without it Open Library answers 200 with a
 * blank placeholder image for covers it does not have, so nothing ever fires an
 * error and the reader gets an empty grey rectangle instead of the generated
 * cover (spec section 17).
 */
export const coverUrlFromId = (coverId: number, size: 'S' | 'M' | 'L'): string =>
  `${OPEN_LIBRARY_COVERS}/id/${coverId}-${size}.jpg?default=false`;

export const coverUrlFromIsbn = (isbn: string, size: 'S' | 'M' | 'L'): string =>
  `${OPEN_LIBRARY_COVERS}/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;

/** Our own cover endpoint. Same origin as the app, so a texture may sample it. */
export const COVER_PROXY_PATH = '/api/cover';

/** Hostnames that are never a public CDN, whatever a pasted URL claims. */
const PRIVATE_HOST = /^(localhost|.*\.(local|internal|localhost|home\.arpa))$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The URL the proxy would actually fetch, or `undefined` to refuse.
 *
 * The reader can paste a cover URL from anywhere (see the edit form), so this
 * cannot be a list of known CDNs - but it must not turn the endpoint into a way
 * to reach things that are not on the public internet. Hence: HTTPS only, no
 * embedded credentials, no default-less port, and nothing addressed by IP or by
 * a name with no public DNS to it. `api/cover.ts` enforces the rest - image
 * content types, a size cap and a timeout - on the response.
 *
 * `http:` is upgraded rather than refused: some providers still hand out plain
 * HTTP cover links, and every host that serves one also serves it over TLS.
 */
export const proxyableCoverUrl = (raw: string): URL | undefined => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  if (url.username || url.password) return undefined;
  if (url.port && url.port !== '443' && url.port !== '80') return undefined;

  const host = url.hostname;
  // A colon survives in `hostname` only for IPv6; brackets are stripped.
  if (IPV4.test(host) || host.includes(':') || !host.includes('.')) return undefined;
  if (PRIVATE_HOST.test(host)) return undefined;

  url.protocol = 'https:';
  url.port = '';
  return url;
};

/** The same cover, served from this origin. `undefined` when it is not fetchable. */
export const proxiedCoverUrl = (raw: string): string | undefined => {
  const url = proxyableCoverUrl(raw);
  return url ? `${COVER_PROXY_PATH}?src=${encodeURIComponent(url.href)}` : undefined;
};

export interface CoverSource {
  coverImage?: string;
  isbn13?: string;
  isbn10?: string;
}

/**
 * Cover URLs to try for a book standing in the room, best first.
 *
 * The book's own cover comes first, because it is the art shown everywhere else
 * and they should match. Open Library by ISBN stays as a second try, for the
 * books a provider gave no cover URL for at all and for the day a jacket link
 * rots. Both go through the proxy, so the room only ever loads from one origin.
 *
 * Returns an empty list when there is nothing worth trying; the caller falls
 * back to a generated cover, which is CORS-free because it never leaves the tab.
 */
export const textureCoverCandidates = (book: CoverSource): string[] => {
  const candidates: string[] = [];

  const add = (raw?: string) => {
    if (!raw) return;
    const proxied = proxiedCoverUrl(raw);
    if (proxied && !candidates.includes(proxied)) candidates.push(proxied);
  };

  add(book.coverImage);

  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) add(coverUrlFromIsbn(isbn, 'L'));

  return candidates;
};
