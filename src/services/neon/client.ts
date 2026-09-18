import { createClient } from '@neondatabase/neon-js';
import { env } from '@/config/env';

export type NeonClient = ReturnType<typeof createClient>;

let cached: NeonClient | undefined;

/**
 * The Neon client, or `undefined` when the library has not been pointed at a
 * database and so lives in this browser only.
 *
 * `allowAnonymous` is what makes a public library possible. Neon's Data API
 * does NOT accept a request with no `Authorization` header at all - it answers
 * `400 missing authentication credentials` - so even a visitor who never signs
 * in needs a token. This asks the auth server for an anonymous one, which maps
 * to the `anonymous` Postgres role, which is granted exactly SELECT on books
 * and INSERT on suggestions.
 *
 * Built once and cached: the client holds the token and refreshes it, and a
 * fresh client per call would re-do that handshake every time.
 */
export const neonClient = (): NeonClient | undefined => {
  if (!env.neonUrl) return undefined;
  cached ??= createClient(env.neonUrl, { auth: { allowAnonymous: true } });
  return cached;
};
