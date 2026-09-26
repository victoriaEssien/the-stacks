import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../uiStore';

beforeEach(() => {
  useUiStore.setState({ viewMode: 'explore', kneeling: false });
});

describe('kneeling', () => {
  it('toggles, so one key or one button both kneels and stands', () => {
    useUiStore.getState().toggleKneeling();
    expect(useUiStore.getState().kneeling).toBe(true);
    useUiStore.getState().toggleKneeling();
    expect(useUiStore.getState().kneeling).toBe(false);
  });

  it('stands the reader up when they leave the room, since coming back starts at the door', () => {
    useUiStore.getState().toggleKneeling();
    useUiStore.getState().setViewMode('list');
    useUiStore.getState().setViewMode('explore');
    expect(useUiStore.getState().kneeling).toBe(false);
  });
});
