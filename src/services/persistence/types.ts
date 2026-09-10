import type { Result } from '@/utils/result';

/**
 * Storage contract. Everything above this line is async on purpose: swapping
 * localStorage for IndexedDB, Supabase or a REST API later is a new class here
 * and a one-line change in `repositories.ts` - no callers change.
 */
export interface Repository<T extends { id: string }> {
  list(): Promise<Result<T[]>>;
  save(entity: T): Promise<Result<T>>;
  saveMany(entities: T[]): Promise<Result<T[]>>;
  remove(id: string): Promise<Result<void>>;
  clear(): Promise<Result<void>>;
}
