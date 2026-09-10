import type { RoomDimensions } from '@/utils/roomLayout';
import { PALETTE } from '../materials/palette';

export interface LibraryLightingProps {
  room: RoomDimensions;
  /** Where the window is, so its cool fill comes from the right direction. */
  windowPosition?: [number, number, number];
}

/**
 * Warm, low-contrast lighting - but bright enough to READ by. A library the
 * reader cannot see their books in is atmospheric and useless.
 *
 * ONE shadow-casting light - shadow maps are the
 * most expensive thing in a scene this size, and a second one buys almost
 * nothing in a room lit mainly by lamps.
 */
export const LibraryLighting = ({
  room,
  windowPosition = [-room.width / 2 + 0.2, 1.7, room.depth / 2 - 1.6],
}: LibraryLightingProps) => {
  const front = room.depth / 2;

  return (
    <>
      <ambientLight intensity={0.75} color="#ffd9b0" />
      <hemisphereLight args={['#ffdcb4', '#3a2c20', 0.8]} />

      {/* Main warm key light, roughly where the desk lamp sits. */}
      <pointLight
        position={[1.6, 1.55, front - 2.2]}
        intensity={16}
        distance={14}
        decay={2}
        color={PALETTE.lampWarm}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />

      {/* Cool spill from the window, so the room is not monochrome. */}
      <pointLight position={windowPosition} intensity={4} distance={9} decay={2} color="#b8d0ff" />

      {/* The stacks are the point of the room, and they sit furthest from the
          desk lamp - without this they fall away into the dark. */}
      <pointLight
        position={[0, 2.2, -room.depth / 2 + 1.6]}
        intensity={11}
        distance={11}
        decay={2}
        color="#ffcf9b"
      />

      {/* Gentle wash down the length of the stacks. */}
      <spotLight
        position={[0, room.height - 0.3, front - 2]}
        angle={1}
        penumbra={0.9}
        intensity={13}
        distance={Math.max(16, room.depth * 1.8)}
        decay={2}
        color="#ffca8f"
      />
    </>
  );
};
