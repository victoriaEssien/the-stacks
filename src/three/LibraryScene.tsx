import { useCallback, useMemo, useRef } from 'react';
import { ContactShadows } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { Book } from '@/models';
import { planLibrary, viewingDistance } from '@/utils/roomLayout';
import { BASE_FOV, restingFov } from '@/utils/touchGestures';
import {
  layOutBooks,
  placementsForCase,
  shelfSurfaceY,
  DEFAULT_SHELF_CONFIG,
} from '@/utils/shelfLayout';
import { Book3D } from './Book3D';
import { Bookshelf } from './Bookshelf';
import { Desk } from './Desk';
import { DustMotes } from './DustMotes';
import { LibraryLighting } from './lighting/LibraryLighting';
import { RoomEnvironment } from './lighting/RoomEnvironment';
import { Room } from './Room';
import { ShelfNote } from './ShelfNote';
import { SuggestionBox } from './SuggestionBox';
import { Chair, Plant, Rug, WindowFrame } from './props';
import { PlayerControls } from './controls/PlayerControls';
import { TouchControls } from './controls/TouchControls';
import { createTouchNavState, requestWalkTo } from './controls/touchNav';

/**
 * How the reader gets around. `pointer-lock` is the desktop first-person walk;
 * `touch` is the same room driven by drag, tap and pinch. `App` picks one from
 * the pointer type - see `useIsCoarsePointer`.
 */
export type NavigationScheme = 'pointer-lock' | 'touch';

/** How much wall the reader should be able to take in when they arrive. */
const FRAMED_WIDTH = 3.2;

export interface LibrarySceneProps {
  /** Books that live on the shelves - "read" only. */
  shelvedBooks: Book[];
  currentBook?: Book;
  selectedBookId?: string;
  /** The most recently shelved book, which gets an entry animation. */
  justAddedId?: string;
  suggestionCount: number;
  /** Bumped when a suggestion is submitted, to post a note into the box. */
  suggestionToken?: number;
  controlsEnabled: boolean;
  navigation?: NavigationScheme;
  reducedMotion?: boolean;
  onSelectBook: (bookId: string) => void;
  onHoverBook: (bookId: string | undefined) => void;
  onOpenSuggestions: () => void;
  onLockChange: (locked: boolean) => void;
  onLockError?: () => void;
}

/**
 * Presentational: it takes data and callbacks, and owns no store access. Keeps
 * the 3D layer swappable and testable in isolation.
 *
 * Nothing here is positioned by hand - `planLibrary` decides where the cases and
 * the furniture stand, and the room grows to fit them.
 */
export const LibraryScene = ({
  shelvedBooks,
  currentBook,
  selectedBookId,
  justAddedId,
  suggestionCount,
  suggestionToken,
  controlsEnabled,
  navigation = 'pointer-lock',
  reducedMotion = false,
  onSelectBook,
  onHoverBook,
  onOpenSuggestions,
  onLockChange,
  onLockError,
}: LibrarySceneProps) => {
  const viewport = useThree((state) => state.size);

  // Written during a gesture, read on the next frame: a ref, never state.
  const touchNav = useRef(createTouchNavState());

  /**
   * Walk to wherever in the room the reader tapped.
   *
   * On the room as a whole rather than on the floor alone. `fov` is vertical,
   * so a phone held upright shows a narrow slice of floor starting a couple of
   * metres out - tapping only the floor would leave most of the screen dead.
   * Tapping a bookcase or a wall heads towards it instead, and collision stops
   * the reader at reading distance rather than inside it.
   *
   * Books, the desk and the suggestion box all stop propagation, so tapping one
   * of those opens it and does not also walk into it.
   */
  const handleRoomTap = useCallback(
    (event: ThreeEvent<MouseEvent>) =>
      requestWalkTo(touchNav.current, event.point.x, event.point.z),
    [],
  );

  const layout = useMemo(() => layOutBooks(shelvedBooks), [shelvedBooks]);
  const plan = useMemo(() => planLibrary(layout.caseCount), [layout.caseCount]);
  const booksById = useMemo(
    () => new Map(shelvedBooks.map((book) => [book.id, book])),
    [shelvedBooks],
  );

  const { room } = plan;
  const halfD = room.depth / 2;
  const windowPosition: [number, number, number] = [-room.width / 2 + 0.04, 1.65, halfD - 1.6];

  // Stand the reader off the first bookcase, lined up with the first book
  // rather than the middle of the case: books pack from the left of a shelf, so
  // a small collection sits well off to one side. Far enough back to see the
  // room, close enough that the books are the subject - and that distance is a
  // function of the screen, not a constant, because a phone held upright sees
  // less than half the width a laptop does.
  const aspect = viewport.width / Math.max(1, viewport.height);
  const standOff = Math.max(
    2.8,
    viewingDistance(FRAMED_WIDTH, navigation === 'touch' ? restingFov(aspect) : BASE_FOV, aspect),
  );

  const firstCase = plan.cases[0];
  const firstBook = layout.placements[0];
  const spawn = {
    x: (firstCase?.position[0] ?? 0) + (firstBook?.position[0] ?? 0),
    z: Math.min(halfD - 1, (firstCase?.position[2] ?? 0) + standOff),
  };

  return (
    <>
      <color attach="background" args={['#14100c']} />
      <fog attach="fog" args={['#1d1712', 9, Math.max(30, room.depth * 3)]} />

      <LibraryLighting room={room} windowPosition={windowPosition} />
      <RoomEnvironment />
      <group onClick={navigation === 'touch' ? handleRoomTap : undefined}>
        <Room {...room} />
        <Rug position={plan.desk.position} radius={1.75} />
        <WindowFrame position={windowPosition} rotation={[0, Math.PI / 2, 0]} />

        {plan.cases.map((bookcase) => (
          <Bookshelf
            key={bookcase.caseIndex}
            position={bookcase.position}
            rotation={bookcase.rotation}
          >
            {placementsForCase(layout, bookcase.caseIndex).map((placement) => {
              const book = booksById.get(placement.bookId);
              if (!book) return null;
              return (
                <Book3D
                  key={book.id}
                  book={book}
                  placement={placement}
                  isSelected={selectedBookId === book.id}
                  animateIn={justAddedId === book.id}
                  reducedMotion={reducedMotion}
                  onSelect={onSelectBook}
                  onHover={onHoverBook}
                />
              );
            })}

            {/* Empty library: a card on the shelf instead of bare wood. */}
            {bookcase.caseIndex === 0 && shelvedBooks.length === 0 && (
              <ShelfNote
                position={[
                  0,
                  shelfSurfaceY(DEFAULT_SHELF_CONFIG.shelvesPerCase - 1, DEFAULT_SHELF_CONFIG) +
                    0.15,
                  0.02,
                ]}
                title="Empty shelves"
                body="Add a book you have finished and it appears right here."
              />
            )}
          </Bookshelf>
        ))}

        {/* Grounds the furniture. Baked once - nothing in here walks about. */}
        <ContactShadows
          key={room.depth}
          position={[0, 0.012, 0]}
          scale={Math.max(room.width, room.depth) * 1.1}
          resolution={1024}
          frames={1}
          blur={2.4}
          opacity={0.55}
          far={2.2}
          color="#150e07"
        />

        <Desk
          position={plan.desk.position}
          rotation={plan.desk.rotation}
          currentBook={currentBook}
          reducedMotion={reducedMotion}
          onSelectBook={onSelectBook}
        />
        <Chair position={plan.chair.position} rotation={plan.chair.rotation} />

        <SuggestionBox
          position={plan.suggestionBox.position}
          rotation={plan.suggestionBox.rotation}
          suggestionCount={suggestionCount}
          noteToken={suggestionToken}
          reducedMotion={reducedMotion}
          onOpen={onOpenSuggestions}
        />

        {plan.plants.map((plant, index) => (
          <Plant
            key={index}
            position={plant.position}
            rotation={plant.rotation}
            seed={`plant-${index}`}
            scale={index === 0 ? 1 : 0.85}
          />
        ))}

        {/* Dust, hanging in the lamplight over the desk. */}
        <DustMotes
          position={[plan.desk.position[0], 1.35, plan.desk.position[2] - 0.2]}
          size={[3.4, 2.2, 3]}
          reducedMotion={reducedMotion}
        />
      </group>

      {navigation === 'touch' ? (
        <TouchControls
          enabled={controlsEnabled}
          room={room}
          obstacles={plan.obstacles}
          spawn={spawn}
          nav={touchNav}
          reducedMotion={reducedMotion}
        />
      ) : (
        <PlayerControls
          enabled={controlsEnabled}
          room={room}
          obstacles={plan.obstacles}
          spawn={spawn}
          onLockChange={onLockChange}
          onLockError={onLockError}
        />
      )}
    </>
  );
};
