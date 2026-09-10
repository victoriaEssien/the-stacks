import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../http';

const respond = (status: number, body: unknown = {}) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson status handling', () => {
  it('names a refused request rather than calling it a network fault', async () => {
    respond(403);
    const result = await fetchJson('https://example.test');
    expect(result.ok).toBe(false);
    // A 403 is nearly always a misconfigured key, and the provider keys off
    // this to say so out loud in dev.
    expect(!result.ok && result.error.kind).toBe('forbidden');
  });

  it('still distinguishes the other failures it already knew about', async () => {
    for (const [status, kind] of [
      [429, 'rate_limited'],
      [404, 'not_found'],
      [500, 'network'],
    ] as const) {
      respond(status);
      const result = await fetchJson('https://example.test');
      expect(!result.ok && result.error.kind).toBe(kind);
    }
  });

  it('passes a successful body straight through', async () => {
    respond(200, { totalItems: 1 });
    const result = await fetchJson<{ totalItems: number }>('https://example.test');
    expect(result.ok && result.value.totalItems).toBe(1);
  });
});
