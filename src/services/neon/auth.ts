import { appError, err, ok, type Result } from '@/utils/result';
import { neonClient } from './client';

/** Who is signed in. Only ever the owner of the library, in practice. */
export interface OwnerSession {
  userId: string;
  email?: string;
}

/**
 * Whether signing in means anything here. On localStorage there is no database
 * to be the owner of, so the reader is simply always allowed to edit.
 */
export const authAvailable = (): boolean => neonClient() !== undefined;

/**
 * The session object's exact shape is not documented, so it is read
 * defensively and narrowed here rather than trusted. This is the only file in
 * the app that touches it.
 */
const toSession = (data: unknown): OwnerSession | undefined => {
  const user = (data as { user?: { id?: unknown; email?: unknown } } | null | undefined)?.user;
  if (typeof user?.id !== 'string' || user.id.length === 0) return undefined;
  return {
    userId: user.id,
    email: typeof user.email === 'string' ? user.email : undefined,
  };
};

const unreachable = (cause: unknown) =>
  appError('network', 'Could not reach the sign-in service.', cause);

/**
 * The client THROWS `AuthApiError` for a refused sign-in rather than returning
 * an error, and that error carries an HTTP `status`. Without reading it, a
 * mistyped password reports itself as "could not reach the sign-in service",
 * which sends whoever is trying to sign in looking for an outage that is not
 * happening.
 */
const statusOf = (cause: unknown): number | undefined => {
  const status = (cause as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
};

/** A 4xx means the service understood and refused. Anything else is an outage. */
const refusalOrOutage = (cause: unknown) => {
  const status = statusOf(cause);
  if (status === 429) {
    return appError('rate_limited', 'Too many attempts. Wait a moment, then try again.', cause);
  }
  if (status !== undefined && status >= 400 && status < 500) {
    // Deliberately not saying WHICH was wrong: distinguishing "no such
    // account" from "wrong password" confirms to a stranger whether a given
    // address holds this library.
    return appError('forbidden', 'That email and password did not match.', cause);
  }
  return unreachable(cause);
};

/** The session restored from storage, or `undefined` when nobody is signed in. */
export const currentSession = async (): Promise<Result<OwnerSession | undefined>> => {
  const client = neonClient();
  if (!client) return ok(undefined);

  try {
    const { data, error } = await client.auth.getSession();
    if (error) return err(unreachable(error));
    return ok(toSession(data));
  } catch (cause) {
    return err(unreachable(cause));
  }
};

export const signIn = async (email: string, password: string): Promise<Result<OwnerSession>> => {
  const client = neonClient();
  if (!client) {
    return err(appError('unknown', 'This library is not connected to a database.'));
  }

  try {
    const { error } = await client.auth.signIn.email({ email, password });
    if (error) return err(refusalOrOutage(error));
  } catch (cause) {
    return err(refusalOrOutage(cause));
  }

  const session = await currentSession();
  if (!session.ok) return session;
  return session.value
    ? ok(session.value)
    : err(appError('unknown', 'Signed in, but no session came back. Try again.'));
};

export const signOut = async (): Promise<Result<void>> => {
  const client = neonClient();
  if (!client) return ok(undefined);

  try {
    await client.auth.signOut();
    return ok(undefined);
  } catch (cause) {
    return err(unreachable(cause));
  }
};
