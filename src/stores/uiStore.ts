import { create } from 'zustand';

/** Which 2D overlay, if any, sits on top of the 3D scene. */
export type Overlay = 'none' | 'add-book' | 'book-info' | 'suggestions' | 'stats' | 'help';

/** `explore` = pointer-locked first person. `list` = accessible 2D browsing. */
export type ViewMode = 'explore' | 'list';

interface UiState {
  overlay: Overlay;
  selectedBookId?: string;
  hoveredBookId?: string;
  viewMode: ViewMode;
  /** True while the 3D canvas owns the pointer. */
  pointerLocked: boolean;

  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  selectBook: (id: string | undefined) => void;
  hoverBook: (id: string | undefined) => void;
  setViewMode: (mode: ViewMode) => void;
  setPointerLocked: (locked: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  overlay: 'none',
  viewMode: 'explore',
  pointerLocked: false,

  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: 'none', selectedBookId: undefined }),
  selectBook: (id) => set({ selectedBookId: id, overlay: id ? 'book-info' : 'none' }),
  hoverBook: (id) => set({ hoveredBookId: id }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
}));

/** True when a 2D panel is open - the 3D controls should stand down. */
export const selectOverlayOpen = (state: UiState): boolean => state.overlay !== 'none';
