/**
 * Model fields are camelCase, Postgres columns are snake_case. This is the only
 * place that knows it, so `snake_case` never leaks past the persistence folder.
 *
 * Converted generically rather than through a hand-written field map: a map has
 * to be edited every time the model grows a field, and the day someone forgets
 * is the day a book silently loses its thoughts. Pure, so it is tested.
 */

/** `coverImage` -> `cover_image`. Digits are left alone, so `isbn13` survives. */
export const toColumn = (field: string): string =>
  field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/** `cover_image` -> `coverImage`. */
export const toField = (column: string): string =>
  column.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

/**
 * A model becomes a row.
 *
 * `undefined` is sent as `null` rather than omitted, and that matters: the store
 * saves a whole book after an edit, so a cleared quote arrives as `undefined`.
 * Omitting the key would leave the old value sitting in the column.
 */
export const toRow = (entity: object): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(entity)) {
    row[toColumn(field)] = value === undefined ? null : value;
  }
  return row;
};

/** A row becomes something the model's type guard can be pointed at. */
export const fromRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const entity: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    // Postgres nulls are absent fields as far as the model is concerned: every
    // optional field on `Book` is `?:`, not `| null`.
    if (value !== null) entity[toField(column)] = value;
  }
  return entity;
};
