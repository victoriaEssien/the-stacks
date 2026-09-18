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

import { COVER_PROXY_PATH } from './endpoints.ts';

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

/**
 * The only hosts `/api/cover` will fetch from. Subdomains count, so
 * `archive.org` covers the `ia600505.us.archive.org` mirror a cover redirects
 * to, and a lookalike like `books.google.com.example.test` does not match.
 *
 * An allowlist rather than a guard against obviously-bad URLs, because this
 * library is public: without one the endpoint is a general purpose image proxy
 * that anybody can point at anything and bill to us. The cost of that choice is
 * that a cover pasted from somewhere else shows everywhere EXCEPT the 3D room,
 * which the edit form says out loud rather than leaving to be discovered.
 *
 * These are the places book covers actually live. The first three are the app's
 * own providers; the rest are where a cover the providers lack is usually found
 * (Wikimedia for the out of print, Amazon's CDN for everything Goodreads shows).
 * Adding one is a line here, and it applies to both the client and the endpoint
 * because both call `proxyableCoverUrl`.
 */
export const COVER_HOSTS = [
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
  'archive.org',
  'upload.wikimedia.org',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'i.gr-assets.com',
  's.gr-assets.com',
] as const;

const isCoverHost = (hostname: string): boolean =>
  COVER_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));

/**
 * The URL the proxy would actually fetch, or `undefined` to refuse.
 *
 * `api/cover.ts` enforces the rest - image content types, a size cap and a
 * timeout - on the response, because a host being the right host says nothing
 * about what it returns today.
 *
 * `http:` is upgraded rather than refused: some providers still hand out plain
 * HTTP cover links, and every host on the list also serves them over TLS.
 */
export const proxyableCoverUrl = (raw: string): URL | undefined => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  // Nothing on the list wants credentials, and forwarding them would make this
  // a credential-carrying hop for no reason.
  if (url.username || url.password) return undefined;
  if (url.port && url.port !== '443' && url.port !== '80') return undefined;
  if (!isCoverHost(url.hostname)) return undefined;

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
 * Deliberately NOT asked for at a larger size. Google's `imageLinks` advertise
 * only a 128px thumbnail for most volumes, and the bigger request forms were
 * measured across eight of them: `&w=800` gave a placeholder for three, an
 * 800x128 distorted strip for two, and the real scan for one; `&zoom=0` was
 * worse. Google marks the placeholder with `max-age=30` where a real scan gets
 * `max-age=86400`, but nothing marks the distorted ones, so a large cover can
 * only be trusted after comparing it against the thumbnail it should match -
 * which is a job for one check when a book is added, not for every render.
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
