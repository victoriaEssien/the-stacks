/** Tiny result type so service calls surface failures without throwing. */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type AppErrorKind =
  | 'network'
  | 'rate_limited'
  | 'forbidden'
  | 'not_found'
  | 'invalid_response'
  | 'persistence'
  | 'duplicate'
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  /** Safe to show a human. */
  message: string;
  cause?: unknown;
}

export const appError = (kind: AppErrorKind, message: string, cause?: unknown): AppError => ({
  kind,
  message,
  cause,
});

export const errorMessage = (error: unknown, fallback = 'Something went wrong.'): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
};
