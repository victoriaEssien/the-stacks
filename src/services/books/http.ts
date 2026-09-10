import { appError, err, ok, type Result } from '@/utils/result';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Fetch + JSON parse with timeout, abort passthrough and typed failures. */
export const fetchJson = async <T>(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Result<T>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === 429) {
      return err(appError('rate_limited', 'The book service is busy. Try again in a moment.'));
    }
    if (response.status === 403) {
      // Nearly always a misconfigured API key rather than anything the reader
      // did: the wrong referrer, the wrong project, or the API not enabled.
      return err(appError('forbidden', 'The book service refused the request.', 403));
    }
    if (response.status === 404) {
      return err(appError('not_found', 'That book could not be found.'));
    }
    if (!response.ok) {
      return err(
        appError('network', `The book service replied with ${response.status}.`, response.status),
      );
    }

    return ok((await response.json()) as T);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      return err(appError('network', 'The request was cancelled.', cause));
    }
    return err(appError('network', 'Could not reach the book service.', cause));
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
};

/** Google and Open Library both serve http:// image URLs; browsers block them. */
export const toHttps = (url?: string): string | undefined =>
  url ? url.replace(/^http:\/\//i, 'https://') : undefined;
