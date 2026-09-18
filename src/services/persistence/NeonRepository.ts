import { appError, err, ok, type Result } from '@/utils/result';
import { fromRow, toRow } from './rows';
import type { Repository } from './types';

/**
 * Generous on purpose. Neon's Free plan suspends a compute after five minutes
 * of inactivity and cannot be told not to, so the first request from a visitor
 * pays for a resume.
 */
const TIMEOUT_MS = 15_000;

export interface NeonRepositoryOptions {
  /** The Data API base URL. Public by design; the guard is GRANTs plus RLS. */
  baseUrl: string;
  /**
   * The owner's bearer token, when signed in. Read fresh on every call rather
   * than captured: Data API JWTs expire after about fifteen minutes, so a token
   * held from construction would be stale before the first edit.
   */
  getToken?: () => string | undefined;
}

/**
 * `Repository<T>` backed by Neon's Data API (PostgREST over Postgres).
 *
 * Deliberately no client library. `@neondatabase/postgrest-js` exists, but this
 * needs five verbs and the repo pays for every dependency it adds.
 *
 * Requests without a token run as the `anonymous` role, which is what lets a
 * visitor read the shelf. Writes need the owner's JWT; RLS refuses them
 * otherwise, which surfaces here as a `forbidden` error rather than a silent
 * no-op.
 */
export class NeonRepository<T extends { id: string }> implements Repository<T> {
  private readonly endpoint: string;
  private readonly validate: (value: unknown) => value is T;
  private readonly options: NeonRepositoryOptions;

  constructor(
    table: string,
    validate: (value: unknown) => value is T,
    options: NeonRepositoryOptions,
  ) {
    this.endpoint = `${options.baseUrl.replace(/\/+$/, '')}/${table}`;
    this.validate = validate;
    this.options = options;
  }

  private async request(
    path: string,
    init: { method: string; body?: unknown; prefer?: string },
  ): Promise<Result<unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const token = this.options.getToken?.();

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method: init.method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(init.prefer === undefined ? {} : { Prefer: init.prefer }),
          ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });

      if (response.status === 401 || response.status === 403) {
        // RLS said no. For a write that means "not signed in as the owner",
        // which is a different problem from the database being unreachable.
        return err(
          appError(
            'forbidden',
            'You are not signed in as the owner of this library.',
            response.status,
          ),
        );
      }
      if (!response.ok) {
        return err(appError('persistence', 'The library could not be reached.', response.status));
      }

      // A 204 carries no body, which `json()` would choke on.
      if (response.status === 204) return ok([]);
      return ok(await response.json());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return err(appError('persistence', 'The library took too long to answer.', cause));
      }
      return err(appError('persistence', 'The library could not be reached.', cause));
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Upsert. `merge-duplicates` is what makes a repeat save an edit, not a clash. */
  private async upsert(entities: T[]): Promise<Result<unknown>> {
    return this.request('', {
      method: 'POST',
      body: entities.map(toRow),
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  async list(): Promise<Result<T[]>> {
    const result = await this.request('?select=*', { method: 'GET' });
    if (!result.ok) return result;
    if (!Array.isArray(result.value)) {
      return err(appError('invalid_response', 'The library answered with something unreadable.'));
    }

    // Drop anything that no longer matches the schema rather than crashing,
    // the same way the localStorage repository does.
    const entities = result.value
      .map((row) => fromRow(row as Record<string, unknown>))
      .filter((entity): entity is T => this.validate(entity));

    return ok(entities);
  }

  async save(entity: T): Promise<Result<T>> {
    const result = await this.upsert([entity]);
    return result.ok ? ok(entity) : result;
  }

  async saveMany(entities: T[]): Promise<Result<T[]>> {
    if (entities.length === 0) return ok([]);
    const result = await this.upsert(entities);
    return result.ok ? ok(entities) : result;
  }

  async remove(id: string): Promise<Result<void>> {
    const result = await this.request(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return result.ok ? ok(undefined) : result;
  }

  async clear(): Promise<Result<void>> {
    // PostgREST refuses an unfiltered DELETE, which is a kindness. `id` is the
    // primary key, so "not null" matches every row and nothing else.
    const result = await this.request('?id=not.is.null', { method: 'DELETE' });
    return result.ok ? ok(undefined) : result;
  }
}
