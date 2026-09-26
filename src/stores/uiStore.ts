import { create } from 'zustand';

/** Which 2D overlay, if any, sits on top of the 3D scene. */
export type Overlay =
  'none' | 'add-book' | 'book-info' | 'suggestions' | 'stats' | 'help' | 'sign-in' | 'local-backup';

/** `explore` = pointer-locked first person. `list` = accessible 2D browsing. */
export type ViewMode = 'explore' | 'list';

interface UiState {
  overlay: Overlay;
  selectedBookId?: string;
  hoveredBookId?: string;
  viewMode: ViewMode;
  /** True while the 3D canvas owns the pointer. */
  pointerLocked: boolean;
  /** Down at the lower shelves rather than standing. */
  kneeling: boolean;

  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  selectBook: (id: string | undefined) => void;
  hoverBook: (id: string | undefined) => void;
  setViewMode: (mode: ViewMode) => void;
  setPointerLocked: (locked: boolean) => void;
  toggleKneeling: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  overlay: 'none',
  viewMode: 'explore',
  pointerLocked: false,
  kneeling: false,

  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: 'none', selectedBookId: undefined }),
  selectBook: (id) => set({ selectedBookId: id, overlay: id ? 'book-info' : 'none' }),
  hoverBook: (id) => set({ hoveredBookId: id }),
  // Coming back to the room puts the reader at the entrance again, and they
  // should arrive on their feet rather than on their knees by the door.
  setViewMode: (viewMode) => set({ viewMode, kneeling: false }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  toggleKneeling: () => set((state) => ({ kneeling: !state.kneeling })),
}));

/** True when a 2D panel is open - the 3D controls should stand down. */
export const selectOverlayOpen = (state: UiState): boolean => state.overlay !== 'none';
