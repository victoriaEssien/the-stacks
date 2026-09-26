import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryHud, type LibraryHudProps } from '../LibraryHud';

const renderHud = (overrides: Partial<LibraryHudProps> = {}) => {
  const onToggleKneel = vi.fn();
  render(
    <LibraryHud
      bookCount={3}
      suggestionCount={0}
      viewMode="explore"
      pointerLocked={false}
      canUse3D
      compact
      onToggleKneel={onToggleKneel}
      onAddBook={() => {}}
      onOpenSuggestions={() => {}}
      onOpenStats={() => {}}
      onOpenHelp={() => {}}
      onToggleViewMode={() => {}}
      {...overrides}
    />,
  );
  return { onToggleKneel, kneel: () => screen.queryByRole('button', { name: 'Kneel' }) };
};

/**
 * A phone has no C key, so kneeling to the lower shelves is a button there. It
 * belongs to the room, not to the app, so it has to come and go with the room.
 */
describe('LibraryHud kneel button', () => {
  it('is offered on touch while in the room, and asks to kneel when pressed', () => {
    const { onToggleKneel, kneel } = renderHud();
    expect(kneel()?.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(kneel()!);
    expect(onToggleKneel).toHaveBeenCalledOnce();
  });

  it('shows as pressed while the reader is kneeling', () => {
    const { kneel } = renderHud({ kneeling: true });
    expect(kneel()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('is there for a visitor too, who cannot add books but can still look', () => {
    const { kneel } = renderHud({ canEdit: false });
    expect(kneel()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a book' })).toBeNull();
  });

  it('goes away in Shelf view, where there is nothing to kneel in', () => {
    const { kneel } = renderHud({ viewMode: 'list' });
    expect(kneel()).toBeNull();
  });

  it('is left to the C key on a pointer', () => {
    const { kneel } = renderHud({ compact: false });
    expect(kneel()).toBeNull();
  });
});
