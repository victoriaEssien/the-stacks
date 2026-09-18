import { appError, err, ok, type AppError, type Result } from '@/utils/result';
import { fromRow, toRow } from './rows';
import type { Repository } from './types';

/** Postgres refused it on privileges. RLS said no. */
const INSUFFICIENT_PRIVILEGE = '42501';
/** PostgREST's code for a JWT that has expired or will not parse. */
const BAD_JWT = 'PGRST301';

export interface NeonQueryError {
  message: string;
  code?: string | null;
}

export interface NeonQueryResult {
  data: unknown;
  error: NeonQueryError | null;
}

interface NeonDeleteBuilder {
  eq(column: string, value: string): PromiseLike<NeonQueryResult>;
  not(column: string, operator: string, value: unknown): PromiseLike<NeonQueryResult>;
}

/**
 * The slice of the Neon client this repository actually uses, declared
 * structurally so a test can hand over a fake with no network in sight.
 */
export interface NeonTable {
  select(): PromiseLike<NeonQueryResult>;
  upsert(rows: Record<string, unknown>[]): PromiseLike<NeonQueryResult>;
  delete(): NeonDeleteBuilder;
}

export interface NeonDataClient {
  from(table: string): NeonTable;
}

/**
 * `Repository<T>` backed by Neon's Data API.
 *
 * The transport and the token are the client's job, not this class's. That was
 * not the first design: this originally spoke to the Data API with plain
 * `fetch` and no dependency, assuming an unauthenticated request would map to
 * the `anonymous` role the way PostgREST usually does. It does not. Neon
 * answers `400 missing authentication credentials` to a request carrying no
 * token, so even a visitor who never signs in needs one minted by the auth
 * server, and acquiring and refreshing that is exactly what the client is for.
 */
export class NeonRepository<T extends { id: string }> implements Repository<T> {
  private readonly client: NeonDataClient;
  private readonly table: string;
  private readonly validate: (value: unknown) => value is T;

  constructor(table: string, validate: (value: unknown) => value is T, client: NeonDataClient) {
    this.table = table;
    this.validate = validate;
    this.client = client;
  }

  /**
   * A refused write is a different problem from an unreachable database, and
   * the reader needs them told apart: one means "sign in", the other "later".
   */
  private static toError(error: NeonQueryError): AppError {
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return appError('forbidden', 'Only the owner of this library can change it.', error);
    }
    if (error.code === BAD_JWT) {
      return appError('forbidden', 'That sign-in has expired. Sign in again.', error);
    }
    return appError('persistence', 'That change could not be saved.', error);
  }

  private async run(query: () => PromiseLike<NeonQueryResult>): Promise<Result<unknown>> {
    try {
      const { data, error } = await query();
      return error ? err(NeonRepository.toError(error)) : ok(data);
    } catch (cause) {
      // Thrown rather than returned: the network is gone, or the client raised
      // AuthRequiredError because there is no session and no anonymous token.
      return err(appError('persistence', 'The library could not be reached.', cause));
    }
  }

  async list(): Promise<Result<T[]>> {
    const result = await this.run(() => this.client.from(this.table).select());
    if (!result.ok) return result;
    if (!Array.isArray(result.value)) {
      return err(appError('invalid_response', 'The library answered with something unreadable.'));
    }

    // Drop anything that no longer matches the schema rather than crashing,
    // the same way the localStorage repository does.
    return ok(
      result.value
        .map((row) => fromRow(row as Record<string, unknown>))
        .filter((entity): entity is T => this.validate(entity)),
    );
  }

  /** Upsert, so saving a book twice is an edit rather than a primary-key clash. */
  private async upsert(entities: T[]): Promise<Result<unknown>> {
    return this.run(() => this.client.from(this.table).upsert(entities.map(toRow)));
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
    const result = await this.run(() => this.client.from(this.table).delete().eq('id', id));
    return result.ok ? ok(undefined) : result;
  }

  async clear(): Promise<Result<void>> {
    // PostgREST refuses an unfiltered DELETE, which is a kindness. `id` is the
    // primary key, so "not null" matches every row and nothing else.
    const result = await this.run(() =>
      this.client.from(this.table).delete().not('id', 'is', null),
    );
    return result.ok ? ok(undefined) : result;
  }
}
