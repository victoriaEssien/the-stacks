import { describe, expect, it } from 'vitest';
import { selectHasLocalBooks, useMigrationStore } from '../migrationStore';

const state = (over: Partial<ReturnType<typeof useMigrationStore.getState>>) => ({
  ...useMigrationStore.getState(),
  ...over,
});

const book = { id: 'b1' } as never;
const suggestion = { id: 's1' } as never;

describe('selectHasLocalBooks', () => {
  it('offers nothing before the browser has been looked at', () => {
    // Otherwise the banner flashes on every load before the scan resolves.
    expect(selectHasLocalBooks(state({ scanned: false, books: [book] }))).toBe(false);
  });

  it('offers the move when this browser is holding books', () => {
    expect(selectHasLocalBooks(state({ scanned: true, books: [book] }))).toBe(true);
  });

  it('counts suggestions too, not just books', () => {
    expect(
      selectHasLocalBooks(state({ scanned: true, books: [], suggestions: [suggestion] })),
    ).toBe(true);
  });

  it('stops offering once the move has happened', () => {
    expect(selectHasLocalBooks(state({ scanned: true, books: [book], imported: true }))).toBe(
      false,
    );
  });

  it('stops offering once it has been declined', () => {
    useMigrationStore.setState({ scanned: true, books: [book], imported: false });
    useMigrationStore.getState().dismiss();
    expect(selectHasLocalBooks(useMigrationStore.getState())).toBe(false);
  });

  it('says nothing when the browser is empty', () => {
    expect(selectHasLocalBooks(state({ scanned: true, books: [], suggestions: [] }))).toBe(false);
  });
});
