import { appError, err, ok, type Result } from '@/utils/result';
import type { Repository } from './types';

/**
 * A tiny localStorage-backed collection.
 *
 * Deliberately dumb: whole-collection read/write. That is fine for the
 * hundreds-of-books scale this app targets, and keeps the swap to a real
 * backend trivial.
 */
export class LocalStorageRepository<T extends { id: string }> implements Repository<T> {
  private readonly key: string;
  private readonly validate: (value: unknown) => value is T;

  constructor(key: string, validate: (value: unknown) => value is T) {
    this.key = key;
    this.validate = validate;
  }

  private read(): Result<T[]> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return ok([]);
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return ok([]);
      // Drop anything that no longer matches the schema rather than crashing.
      return ok(parsed.filter(this.validate));
    } catch (cause) {
      return err(appError('persistence', 'Saved data could not be read.', cause));
    }
  }

  private write(entities: T[]): Result<T[]> {
    try {
      localStorage.setItem(this.key, JSON.stringify(entities));
      return ok(entities);
    } catch (cause) {
      const quotaExceeded =
        cause instanceof DOMException && (cause.name === 'QuotaExceededError' || cause.code === 22);
      return err(
        appError(
          'persistence',
          quotaExceeded
            ? 'Your browser storage is full, so that change was not saved.'
            : 'That change could not be saved.',
          cause,
        ),
      );
    }
  }

  async list(): Promise<Result<T[]>> {
    return this.read();
  }

  async save(entity: T): Promise<Result<T>> {
    const current = this.read();
    if (!current.ok) return current;

    const index = current.value.findIndex((item) => item.id === entity.id);
    const next =
      index === -1
        ? [...current.value, entity]
        : current.value.map((item) => (item.id === entity.id ? entity : item));

    const written = this.write(next);
    return written.ok ? ok(entity) : written;
  }

  async saveMany(entities: T[]): Promise<Result<T[]>> {
    const current = this.read();
    if (!current.ok) return current;

    const byId = new Map(current.value.map((item) => [item.id, item]));
    for (const entity of entities) byId.set(entity.id, entity);

    const written = this.write([...byId.values()]);
    return written.ok ? ok(entities) : written;
  }

  async remove(id: string): Promise<Result<void>> {
    const current = this.read();
    if (!current.ok) return current;

    const written = this.write(current.value.filter((item) => item.id !== id));
    return written.ok ? ok(undefined) : written;
  }

  async clear(): Promise<Result<void>> {
    try {
      localStorage.removeItem(this.key);
      return ok(undefined);
    } catch (cause) {
      return err(appError('persistence', 'Stored data could not be cleared.', cause));
    }
  }
}
