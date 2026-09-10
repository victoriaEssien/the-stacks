/**
 * Where cover art comes from, and which of it WebGL is allowed to touch.
 *
 * This lives in the books service because it is knowledge about PROVIDERS -
 * their CDNs and the headers they send - which nothing outside this folder is
 * supposed to hold.
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

/**
 * Hosts measured to serve covers with NO `Access-Control-Allow-Origin`, even
 * when the request carries an `Origin`.
 *
 * This is not a detail: a WebGL texture must come from a CORS-clean image, so
 * an image from one of these hosts cannot be put on a book in the room at all.
 * The browser refuses the load outright - it is not merely that the spine
 * colour cannot be sampled from it.
 */
const NO_CORS_HOSTS = ['books.google.com', 'books.googleusercontent.com'];

/** Whether an image from this URL can legally become a texture. */
export const isTextureSafeCover = (url: string): boolean =>
  !NO_CORS_HOSTS.some((host) => {
    try {
      return new URL(url, 'https://x.invalid').hostname === host;
    } catch {
      return false;
    }
  });

export interface CoverSource {
  coverImage?: string;
  isbn13?: string;
  isbn10?: string;
}

/**
 * Cover URLs to try for a book standing in the room, best first.
 *
 * Google Books is the primary metadata provider and its jackets are the better
 * artwork, so they stay the cover everywhere an ordinary `<img>` is used. They
 * cannot be used in the 3D room, though - see `NO_CORS_HOSTS` - so for a book
 * that has an ISBN we ask Open Library, whose CDN does send the header, for the
 * same jacket. Without this every Google-sourced book on the shelves wore a
 * generated placeholder while its real cover showed perfectly well in list view.
 *
 * Returns an empty list when there is nothing worth trying; the caller falls
 * back to a generated cover, which is CORS-free because it never leaves the tab.
 */
export const textureCoverCandidates = (book: CoverSource): string[] => {
  const candidates: string[] = [];

  if (book.coverImage && isTextureSafeCover(book.coverImage)) candidates.push(book.coverImage);

  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) {
    const fromIsbn = coverUrlFromIsbn(isbn, 'L');
    if (!candidates.includes(fromIsbn)) candidates.push(fromIsbn);
  }

  return candidates;
};
