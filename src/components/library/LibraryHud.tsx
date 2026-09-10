import type { ReactNode } from 'react';
import type { ViewMode } from '@/stores/uiStore';
import {
  BooksIcon,
  Button,
  Fab,
  HelpIcon,
  MailIcon,
  PlusIcon,
  StarIcon,
  Toast,
} from '@/components/ui';

/**
 * Where the reader is. Three destinations, because that is how many there
 * actually are - adding a book is an action, and Room and Shelf are two views
 * of the same shelf. Neither of those is a place.
 */
export type HudTab = 'library' | 'ideas' | 'reading';

export interface LibraryHudProps {
  bookCount: number;
  suggestionCount: number;
  viewMode: ViewMode;
  pointerLocked: boolean;
  canUse3D: boolean;
  /** Transient confirmation, e.g. after a book is shelved. */
  notice?: string;
  /** How to get around, phrased for whatever is doing the pointing. */
  hint?: ReactNode;
  /** True on touch, where the HUD becomes an app shell. */
  compact?: boolean;
  /** Which tab is lit. Only meaningful when `compact`. */
  activeTab?: HudTab;
  onSelectTab?: (tab: HudTab) => void;
  onAddBook: () => void;
  onOpenSuggestions: () => void;
  onOpenStats: () => void;
  onOpenHelp: () => void;
  onToggleViewMode: () => void;
}

/** One destination in the touch tab bar. */
const Tab = ({
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
    className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors ${
      active ? 'text-brass-bright' : 'text-parchment-dim active:bg-ink-700'
    }`}
  >
    {icon}
    <span className="text-[11px] leading-none">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute right-1/2 top-1.5 -mr-3.5 min-w-4 rounded-full bg-brass px-1 text-center text-[10px] font-medium leading-4 text-ink-900">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </button>
);

/** One half of the Room / Shelf switch. */
const Segment = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`min-h-9 rounded-full px-3.5 text-xs font-medium transition-colors ${
      active ? 'bg-brass text-ink-900' : 'text-parchment-dim'
    }`}
  >
    {label}
  </button>
);

/**
 * Everything overlaid on the scene. `pointer-events-none` on the wrapper so the
 * 3D canvas keeps receiving clicks everywhere the HUD is not.
 *
 * Two layouts. On a pointer the actions sit top-right, out of the way of a room
 * you are looking straight down. On touch it becomes an app shell: destinations
 * in a bar under the thumb, the create action on a button of its own, and the
 * Room/Shelf switch up in the header where a view toggle belongs - it changes
 * how you are looking at the library rather than taking you somewhere else.
 */
export const LibraryHud = ({
  bookCount,
  suggestionCount,
  viewMode,
  pointerLocked,
  canUse3D,
  notice,
  hint,
  compact = false,
  activeTab = 'library',
  onSelectTab,
  onAddBook,
  onOpenSuggestions,
  onOpenStats,
  onOpenHelp,
  onToggleViewMode,
}: LibraryHudProps) => {
  // The other tabs bring their own header and own the screen; the room's
  // floating chrome would sit on top of it.
  const onLibrary = !compact || activeTab === 'library';

  return (
    <div className="inset-safe pointer-events-none fixed inset-0 z-30">
      <div className="flex h-full flex-col justify-between p-3 sm:p-5">
        {onLibrary ? (
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-panel border border-ink-600/70 bg-ink-800/70 px-4 py-2.5 backdrop-blur-sm">
              <h1 className="font-serif text-lg leading-none text-parchment">The Stacks</h1>
              <p className="mt-1 text-xs text-parchment-dim">
                {bookCount === 0
                  ? 'The shelves are waiting'
                  : `${bookCount} book${bookCount === 1 ? '' : 's'} read`}
              </p>
            </div>

            {compact ? (
              <div className="pointer-events-auto flex items-center gap-2">
                {canUse3D && (
                  <div className="flex items-center rounded-full border border-ink-600/70 bg-ink-800/70 p-0.5 backdrop-blur-sm">
                    <Segment
                      label="Room"
                      active={viewMode === 'explore'}
                      onClick={() => viewMode !== 'explore' && onToggleViewMode()}
                    />
                    <Segment
                      label="Shelf"
                      active={viewMode === 'list'}
                      onClick={() => viewMode !== 'list' && onToggleViewMode()}
                    />
                  </div>
                )}
                <Button
                  variant="quiet"
                  aria-label="How this works"
                  onClick={onOpenHelp}
                  className="rounded-full border border-ink-600/70 bg-ink-800/70 backdrop-blur-sm"
                >
                  <HelpIcon className="h-4.5 w-4.5" />
                </Button>
              </div>
            ) : (
              <nav className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
                <Button variant="primary" onClick={onAddBook}>
                  + Add book
                </Button>
                <Button onClick={onOpenSuggestions}>
                  Suggestions{suggestionCount > 0 ? ` · ${suggestionCount}` : ''}
                </Button>
                <Button onClick={onOpenStats}>Reading</Button>
                {canUse3D && (
                  <Button variant="quiet" onClick={onToggleViewMode}>
                    {viewMode === 'explore' ? 'List view' : 'Walk around'}
                  </Button>
                )}
                <Button variant="quiet" aria-label="How this works" onClick={onOpenHelp}>
                  ?
                </Button>
              </nav>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Everything that belongs at the bottom, stacked: the tab bar sits
            under the thumb, the create action clear of it, and whatever the
            room is saying above both rather than stranded mid-view. */}
        <div className="flex flex-col items-center gap-2">
          {notice && <Toast message={notice} />}

          {onLibrary && hint && (
            <p className="max-w-md rounded-full border border-ink-600/70 bg-ink-800/70 px-4 py-2 text-center text-xs text-parchment-dim backdrop-blur-sm">
              {hint}
            </p>
          )}

          {compact && onLibrary && (
            <div className="flex w-full justify-end pb-1 pr-1">
              <Fab label="Add a book" onClick={onAddBook}>
                <PlusIcon className="h-6 w-6" />
              </Fab>
            </div>
          )}

          {compact && (
            <nav
              aria-label="Library"
              className="pointer-events-auto flex h-14 w-full items-stretch rounded-panel border border-ink-600/70 bg-ink-800/85 px-1 backdrop-blur-sm"
            >
              <Tab
                icon={<BooksIcon />}
                label="Library"
                active={activeTab === 'library'}
                onClick={() => onSelectTab?.('library')}
              />
              <Tab
                icon={<MailIcon />}
                label="Ideas"
                badge={suggestionCount}
                active={activeTab === 'ideas'}
                onClick={() => onSelectTab?.('ideas')}
              />
              <Tab
                icon={<StarIcon />}
                label="Reading"
                active={activeTab === 'reading'}
                onClick={() => onSelectTab?.('reading')}
              />
            </nav>
          )}
        </div>
      </div>

      {/* Crosshair, only while walking with a mouse. */}
      {viewMode === 'explore' && pointerLocked && (
        <span className="pointer-events-none fixed left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-parchment/60" />
      )}
    </div>
  );
};
