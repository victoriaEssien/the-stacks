import { describe, expect, it } from 'vitest';
import {
  COVER_HOSTS,
  COVER_PROXY_PATH,
  coverUrlFromIsbn,
  OPEN_LIBRARY_COVERS,
  proxiedCoverUrl,
  proxyableCoverUrl,
  textureCoverCandidates,
} from '../covers';

const GOOGLE = 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1';
const OPEN_LIBRARY = `${OPEN_LIBRARY_COVERS}/isbn/9780000000001-L.jpg?default=false`;

/** The upstream URL a proxied candidate will fetch. */
const upstreamOf = (candidate: string): string | null =>
  new URL(candidate, 'https://x.invalid').searchParams.get('src');

describe('coverUrlFromIsbn', () => {
  it('asks for a real cover rather than a blank placeholder', () => {
    expect(coverUrlFromIsbn('9780000000001', 'L')).toContain('default=false');
  });

  it('escapes whatever it is handed', () => {
    expect(coverUrlFromIsbn('12 34/56', 'M')).not.toContain(' ');
    expect(coverUrlFromIsbn('12 34/56', 'M')).not.toContain('34/56');
  });
});

describe('proxyableCoverUrl', () => {
  it("accepts the app's own providers", () => {
    expect(proxyableCoverUrl(GOOGLE)?.href).toBe(GOOGLE);
    expect(proxyableCoverUrl(OPEN_LIBRARY)?.href).toBe(OPEN_LIBRARY);
  });

  it('accepts every host on the list', () => {
    for (const host of COVER_HOSTS) {
      expect(proxyableCoverUrl(`https://${host}/cover.jpg`)?.hostname, host).toBe(host);
    }
  });

  it('accepts a subdomain, which is how Open Library covers are really served', () => {
    expect(proxyableCoverUrl('https://ia600505.us.archive.org/view_archive.php')?.href).toContain(
      'archive.org',
    );
  });

  it('refuses a host that is not on the list, however public it is', () => {
    expect(proxyableCoverUrl('https://example.com/cover.jpg')).toBeUndefined();
    expect(proxyableCoverUrl('https://i.imgur.com/abc.jpg')).toBeUndefined();
  });

  it('is not fooled by a lookalike host', () => {
    for (const raw of [
      'https://books.google.com.example.test/x.jpg',
      'https://notbooks.google.com/x.jpg',
      'https://archive.org.evil.test/x.jpg',
      'https://evilarchive.org/x.jpg',
    ]) {
      expect(proxyableCoverUrl(raw), raw).toBeUndefined();
    }
  });

  it('upgrades http, which some providers still hand out', () => {
    expect(proxyableCoverUrl('http://books.google.com/x.jpg')?.href).toBe(
      'https://books.google.com/x.jpg',
    );
    expect(proxyableCoverUrl('http://books.google.com:80/x.jpg')?.href).toBe(
      'https://books.google.com/x.jpg',
    );
  });

  it('refuses anything that is not on the public internet at all', () => {
    for (const raw of [
      'https://127.0.0.1/x.jpg',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/x.jpg',
      'https://localhost/x.jpg',
      'https://localhost:5173/x.jpg',
      'https://metadata/x.jpg',
      'https://printer.local/x.jpg',
      'https://vault.internal/x.jpg',
    ]) {
      expect(proxyableCoverUrl(raw), raw).toBeUndefined();
    }
  });

  it('refuses a scheme, port or credentials that no cover CDN needs', () => {
    expect(proxyableCoverUrl('file:///etc/passwd')).toBeUndefined();
    expect(proxyableCoverUrl('data:image/png;base64,iVBOR')).toBeUndefined();
    expect(proxyableCoverUrl('https://books.google.com:8080/x.jpg')).toBeUndefined();
    expect(proxyableCoverUrl('https://user:pass@books.google.com/x.jpg')).toBeUndefined();
  });

  it('refuses an unparseable or relative url rather than throwing', () => {
    expect(proxyableCoverUrl('not a url')).toBeUndefined();
    expect(proxyableCoverUrl('/covers/x.jpg')).toBeUndefined();
    expect(proxyableCoverUrl('')).toBeUndefined();
  });
});

describe('proxiedCoverUrl', () => {
  it('points at our own endpoint, so the image is same-origin', () => {
    const proxied = proxiedCoverUrl(GOOGLE);
    expect(proxied?.startsWith(`${COVER_PROXY_PATH}?src=`)).toBe(true);
  });

  it('encodes the upstream so its query does not merge into ours', () => {
    const proxied = proxiedCoverUrl(GOOGLE) ?? '';
    expect(proxied).not.toContain('&printsec');
    expect(upstreamOf(proxied)).toBe(GOOGLE);
  });

  it('gives nothing back for a url the proxy would refuse', () => {
    expect(proxiedCoverUrl('https://localhost/x.jpg')).toBeUndefined();
    expect(proxiedCoverUrl('https://example.com/cover.jpg')).toBeUndefined();
  });
});

describe('textureCoverCandidates', () => {
  it("offers the book's own cover first, so the room and the panel agree", () => {
    const [first] = textureCoverCandidates({ coverImage: GOOGLE, isbn13: '9780000000001' });
    expect(upstreamOf(first ?? '')).toBe(GOOGLE);
  });

  it('asks for the cover exactly as stored, never at a guessed larger size', () => {
    const candidates = textureCoverCandidates({ coverImage: GOOGLE });
    expect(candidates).toHaveLength(1);
    expect(upstreamOf(candidates[0] ?? '')).toBe(GOOGLE);
  });

  it('keeps Open Library by ISBN as a second try', () => {
    const candidates = textureCoverCandidates({ coverImage: GOOGLE, isbn13: '9780000000001' });
    expect(candidates).toHaveLength(2);
    expect(upstreamOf(candidates[1] ?? '')).toContain(OPEN_LIBRARY_COVERS);
    expect(upstreamOf(candidates[1] ?? '')).toContain('9780000000001');
  });

  it('routes every candidate through the proxy, never straight at a CDN', () => {
    for (const book of [
      { coverImage: GOOGLE },
      { coverImage: GOOGLE, isbn10: '0000000001' },
      { coverImage: OPEN_LIBRARY, isbn13: '9780000000001' },
      { isbn13: '9780000000001' },
    ]) {
      const candidates = textureCoverCandidates(book);
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(candidate.startsWith(`${COVER_PROXY_PATH}?src=`), candidate).toBe(true);
      }
    }
  });

  it('carries a cover pasted from a host on the list, unaltered', () => {
    const pasted = 'https://m.media-amazon.com/images/I/my-own-scan.jpg';
    const candidates = textureCoverCandidates({ coverImage: pasted });
    expect(candidates).toHaveLength(1);
    expect(upstreamOf(candidates[0] ?? '')).toBe(pasted);
  });

  it('skips a cover the room cannot fetch, so the shelf draws one instead', () => {
    expect(textureCoverCandidates({ coverImage: 'https://example.com/scan.jpg' })).toEqual([]);
  });

  it('falls back to ISBN 10 when there is no 13', () => {
    expect(upstreamOf(textureCoverCandidates({ isbn10: '0000000001' })[0] ?? '')).toContain(
      '0000000001',
    );
  });

  it('prefers ISBN 13 when both are present', () => {
    const [first] = textureCoverCandidates({ isbn13: '9780000000001', isbn10: '0000000001' });
    expect(upstreamOf(first ?? '')).toContain('9780000000001');
  });

  it('offers nothing when there is no cover and no ISBN', () => {
    expect(textureCoverCandidates({})).toEqual([]);
    expect(textureCoverCandidates({ coverImage: 'not a url' })).toEqual([]);
  });

  it('still reaches Open Library when the pasted cover is off the list', () => {
    const candidates = textureCoverCandidates({
      coverImage: 'https://example.com/scan.jpg',
      isbn13: '9780000000001',
    });
    expect(candidates).toHaveLength(1);
    expect(upstreamOf(candidates[0] ?? '')).toContain(OPEN_LIBRARY_COVERS);
  });

  it('does not list the same url twice', () => {
    const candidates = textureCoverCandidates({
      coverImage: OPEN_LIBRARY,
      isbn13: '9780000000001',
    });
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
