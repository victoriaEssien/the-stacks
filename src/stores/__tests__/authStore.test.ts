import { describe, expect, it } from 'vitest';
import { canEditLibrary } from '../authStore';

const OWNER = '44eadee3-b4f1-4e1a-8324-8f795fc35cfb';
const STRANGER = '00000000-0000-0000-0000-000000000000';

describe('canEditLibrary', () => {
  it('lets the reader edit their own browser, signed in or not', () => {
    // No database means no owner to be: this is their localStorage.
    expect(canEditLibrary({ remote: false })).toBe(true);
    expect(canEditLibrary({ remote: false, sessionUserId: STRANGER })).toBe(true);
  });

  it('offers nothing to a visitor with no session', () => {
    expect(canEditLibrary({ remote: true, ownerId: OWNER })).toBe(false);
  });

  it('offers everything to the owner', () => {
    expect(canEditLibrary({ remote: true, ownerId: OWNER, sessionUserId: OWNER })).toBe(true);
  });

  it('offers nothing to a stranger who merely signed in', () => {
    // The flaw this replaces: being signed in was taken to mean being the
    // owner, so anyone with an account saw Add, Edit and Remove and had every
    // one refused by RLS.
    expect(canEditLibrary({ remote: true, ownerId: OWNER, sessionUserId: STRANGER })).toBe(false);
  });

  it('fails closed when the owner is not configured', () => {
    // Buttons vanishing is recoverable and obvious. Buttons appearing for a
    // stranger is not.
    expect(canEditLibrary({ remote: true, sessionUserId: OWNER })).toBe(false);
    expect(canEditLibrary({ remote: true, ownerId: undefined, sessionUserId: undefined })).toBe(
      false,
    );
  });

  it('does not treat an empty owner id as matching an absent session', () => {
    expect(canEditLibrary({ remote: true, ownerId: '', sessionUserId: undefined })).toBe(false);
  });
});
