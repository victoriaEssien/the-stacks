import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AddBookDialog, BookInfoPanel } from '@/components/books';
import {
  CanvasErrorBoundary,
  HelpPanel,
  LibraryHud,
  ListModeLibrary,
  ReadingStats,
  type HudTab,
} from '@/components/library';
import { SuggestionsPanel } from '@/components/suggestions';
import { ErrorNote, LoadingVeil } from '@/components/ui';
import { useIsCoarsePointer, useLibraryBootstrap, useReducedMotion } from '@/hooks';
import { LibraryCanvas, LibraryScene } from '@/three';
import { selectCurrentlyReading, selectShelvedBooks, useLibraryStore } from '@/stores/libraryStore';
import { useSuggestionStore } from '@/stores/suggestionStore';
import { useUiStore } from '@/stores/uiStore';
import { isWebGLAvailable } from '@/utils/webgl';

/** How long the "shelved" confirmation stays up. */
const TOAST_MS = 3500;

/**
 * How long the touch controls explain themselves for. The desktop hint can sit
 * there indefinitely because it disappears the moment you click; a touch reader
 * is already dragging, so a permanent banner would only cover the room.
 */
const TOUCH_HINT_MS = 9000;

const TOUCH_HINT = 'Drag to look · tap the floor to walk · tap a book to open it';

/** Shown until the reader clicks the room and the browser hands over the mouse. */
const POINTER_HINT = (
  <>
    Click, then move the mouse to look around · <kbd className="text-parchment">W A S D</kbd> to
    walk ·<kbd className="ml-1 text-parchment">Esc</kbd> to release the cursor
  </>
);

export const App = () => {
  const loadState = useLibraryBootstrap();
  const coarsePointer = useIsCoarsePointer();
  const reducedMotion = useReducedMotion();
  // Probed once: the answer cannot change for the life of the document.
  const [webglOk] = useState(isWebGLAvailable);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [lockRefused, setLockRefused] = useState(false);
  const [touchHintVisible, setTouchHintVisible] = useState(true);

  const books = useLibraryStore((state) => state.books);
  const libraryError = useLibraryStore((state) => state.error);
  const clearLibraryError = useLibraryStore((state) => state.clearError);
  const justAddedId = useLibraryStore((state) => state.justAddedId);
  const clearJustAdded = useLibraryStore((state) => state.clearJustAdded);
  const suggestionCount = useSuggestionStore((state) => state.suggestions.length);
  const suggestionToken = useSuggestionStore((state) => state.submittedCount);

  const overlay = useUiStore((state) => state.overlay);
  const selectedBookId = useUiStore((state) => state.selectedBookId);
  const viewMode = useUiStore((state) => state.viewMode);
  const pointerLocked = useUiStore((state) => state.pointerLocked);
  const openOverlay = useUiStore((state) => state.openOverlay);
  const closeOverlay = useUiStore((state) => state.closeOverlay);
  const selectBook = useUiStore((state) => state.selectBook);
  const hoverBook = useUiStore((state) => state.hoverBook);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setPointerLocked = useUiStore((state) => state.setPointerLocked);

  // selectShelvedBooks derives a new array; useShallow keeps the reference stable.
  const shelvedBooks = useLibraryStore(useShallow(selectShelvedBooks));
  const currentBook = useLibraryStore(selectCurrentlyReading);
  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId),
    [books, selectedBookId],
  );

  // The 3D room is an enhancement. A browser without WebGL, or a canvas that
  // has already failed, gets the list instead (spec section 16).
  const canUse3D = webglOk && !canvasFailed;
  const effectiveMode = canUse3D ? viewMode : 'list';
  const overlayOpen = overlay !== 'none';

  // Pointer lock is the one thing about the room that cannot work on a
  // touchscreen, so touch gets its own camera rather than its own fallback.
  const navigation = coarsePointer ? 'touch' : 'pointer-lock';

  /**
   * Which tab the touch shell lights up.
   *
   * Derived from the overlay rather than stored beside it. Two places that both
   * claim to know where the reader is will disagree eventually - closing the
   * suggestions panel with Escape, say, would leave its tab lit with nothing
   * open. Suggestions and Reading ARE the destinations; the rest of the
   * overlays are things that opened on top of the library.
   */
  const activeTab: HudTab =
    overlay === 'suggestions' ? 'ideas' : overlay === 'stats' ? 'reading' : 'library';

  const selectTab = useCallback(
    (tab: HudTab) => {
      if (tab === 'ideas') openOverlay('suggestions');
      else if (tab === 'reading') openOverlay('stats');
      else closeOverlay();
    },
    [closeOverlay, openOverlay],
  );

  const toggleViewMode = useCallback(
    () => setViewMode(viewMode === 'explore' ? 'list' : 'explore'),
    [setViewMode, viewMode],
  );

  // Once per visit, not once per trip into the room: having read it, the
  // reader does not need it again, and the help panel is there if they do.
  useEffect(() => {
    if (navigation !== 'touch' || effectiveMode !== 'explore' || !touchHintVisible) return;
    const timer = setTimeout(() => setTouchHintVisible(false), TOUCH_HINT_MS);
    return () => clearTimeout(timer);
  }, [navigation, effectiveMode, touchHintVisible]);

  useEffect(() => {
    if (!lockRefused) return;
    const timer = setTimeout(() => setLockRefused(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [lockRefused]);

  // The new book keeps its entry animation; the confirmation does not linger.
  useEffect(() => {
    if (!justAddedId) return;
    const timer = setTimeout(clearJustAdded, TOAST_MS);
    return () => clearTimeout(timer);
  }, [justAddedId, clearJustAdded]);

  if (loadState === 'idle' || loadState === 'loading') {
    return <LoadingVeil />;
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-ink-900">
      {effectiveMode === 'explore' ? (
        <CanvasErrorBoundary onError={() => setCanvasFailed(true)}>
          <LibraryCanvas lowPower={coarsePointer} paused={coarsePointer && activeTab !== 'library'}>
            <LibraryScene
              shelvedBooks={shelvedBooks}
              currentBook={currentBook}
              selectedBookId={selectedBookId}
              justAddedId={justAddedId}
              suggestionCount={suggestionCount}
              suggestionToken={suggestionToken}
              controlsEnabled={!overlayOpen}
              navigation={navigation}
              reducedMotion={reducedMotion}
              onSelectBook={selectBook}
              onHoverBook={hoverBook}
              onOpenSuggestions={() => openOverlay('suggestions')}
              onLockChange={setPointerLocked}
              onLockError={() => setLockRefused(true)}
            />
          </LibraryCanvas>
        </CanvasErrorBoundary>
      ) : (
        <ListModeLibrary books={books} onSelectBook={selectBook} />
      )}

      <LibraryHud
        bookCount={shelvedBooks.length}
        suggestionCount={suggestionCount}
        viewMode={effectiveMode}
        pointerLocked={pointerLocked}
        canUse3D={canUse3D}
        compact={coarsePointer}
        activeTab={activeTab}
        onSelectTab={selectTab}
        hint={
          effectiveMode !== 'explore'
            ? undefined
            : navigation === 'touch'
              ? touchHintVisible
                ? TOUCH_HINT
                : undefined
              : pointerLocked
                ? undefined
                : POINTER_HINT
        }
        notice={
          lockRefused
            ? 'The browser would not hand over the mouse. Click again in a moment.'
            : justAddedId
              ? 'Shelved. It is on the shelf now.'
              : undefined
        }
        onAddBook={() => openOverlay('add-book')}
        onOpenSuggestions={() => openOverlay('suggestions')}
        onOpenStats={() => openOverlay('stats')}
        onOpenHelp={() => openOverlay('help')}
        onToggleViewMode={toggleViewMode}
      />

      {loadState === 'error' && libraryError && (
        <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-5 sm:w-96">
          <ErrorNote message={libraryError.message} onRetry={clearLibraryError} />
        </div>
      )}

      {overlay === 'add-book' && <AddBookDialog onClose={closeOverlay} />}
      {/* On touch these are tabs, so they render as screens with the bar still
          showing. `Panel` treats `screen` as an ordinary modal on a pointer. */}
      {overlay === 'suggestions' && <SuggestionsPanel placement="screen" onClose={closeOverlay} />}
      {overlay === 'stats' && (
        <ReadingStats books={books} placement="screen" onClose={closeOverlay} />
      )}
      {overlay === 'help' && <HelpPanel navigation={navigation} onClose={closeOverlay} />}
      {overlay === 'book-info' && selectedBook && (
        <BookInfoPanel book={selectedBook} onClose={closeOverlay} />
      )}
    </main>
  );
};
