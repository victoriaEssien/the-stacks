import { describe, expect, it } from 'vitest';
import {
  coverUrlFromIsbn,
  isTextureSafeCover,
  OPEN_LIBRARY_COVERS,
  textureCoverCandidates,
} from '../covers';

const GOOGLE = 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1';
const OPEN_LIBRARY = `${OPEN_LIBRARY_COVERS}/isbn/9780000000001-L.jpg?default=false`;

describe('coverUrlFromIsbn', () => {
  it('asks for a real cover rather than a blank placeholder', () => {
    expect(coverUrlFromIsbn('9780000000001', 'L')).toContain('default=false');
  });

  it('escapes whatever it is handed', () => {
    expect(coverUrlFromIsbn('12 34/56', 'M')).not.toContain(' ');
    expect(coverUrlFromIsbn('12 34/56', 'M')).not.toContain('34/56');
  });
});

describe('isTextureSafeCover', () => {
  it('rejects hosts that send no CORS header, which WebGL will not sample', () => {
    expect(isTextureSafeCover(GOOGLE)).toBe(false);
    expect(isTextureSafeCover('https://books.googleusercontent.com/books/content?id=x')).toBe(
      false,
    );
  });

  it('accepts Open Library, which does send one', () => {
    expect(isTextureSafeCover(OPEN_LIBRARY)).toBe(true);
  });

  it('does not mistake a lookalike host for the real one', () => {
    expect(isTextureSafeCover('https://books.google.com.evil.test/x.jpg')).toBe(true);
    expect(isTextureSafeCover('https://notbooks.google.com/x.jpg')).toBe(true);
  });

  it('treats an unparseable url as safe rather than throwing', () => {
    expect(isTextureSafeCover('not a url')).toBe(true);
  });
});

describe('textureCoverCandidates', () => {
  it('keeps a cover that is already safe to sample', () => {
    expect(textureCoverCandidates({ coverImage: OPEN_LIBRARY })).toEqual([OPEN_LIBRARY]);
  });

  it('swaps a Google jacket for the same book from Open Library', () => {
    const candidates = textureCoverCandidates({ coverImage: GOOGLE, isbn13: '9780000000001' });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toContain(OPEN_LIBRARY_COVERS);
    expect(candidates[0]).toContain('9780000000001');
  });

  it('never offers a url the room cannot load', () => {
    for (const book of [
      { coverImage: GOOGLE },
      { coverImage: GOOGLE, isbn10: '0000000001' },
      { coverImage: OPEN_LIBRARY, isbn13: '9780000000001' },
    ]) {
      expect(textureCoverCandidates(book).every(isTextureSafeCover)).toBe(true);
    }
  });

  it('falls back to ISBN 10 when there is no 13', () => {
    expect(textureCoverCandidates({ isbn10: '0000000001' })[0]).toContain('0000000001');
  });

  it('prefers ISBN 13 when both are present', () => {
    const [first] = textureCoverCandidates({ isbn13: '9780000000001', isbn10: '0000000001' });
    expect(first).toContain('9780000000001');
  });

  it('offers nothing for a Google cover with no ISBN, so the generated one is used', () => {
    expect(textureCoverCandidates({ coverImage: GOOGLE })).toEqual([]);
    expect(textureCoverCandidates({})).toEqual([]);
  });

  it('does not list the same url twice', () => {
    const candidates = textureCoverCandidates({
      coverImage: OPEN_LIBRARY,
      isbn13: '9780000000001',
    });
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
