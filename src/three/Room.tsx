import { CASE_PANEL } from '@/utils/roomLayout';
import { useSharedMaterials } from './materials/useSharedMaterials';

export interface RoomProps {
  width?: number;
  depth?: number;
  height?: number;
}

const SKIRTING_H = 0.12;
const CORNICE_H = 0.14;
const BEAM_SPACING = 2.2;

/**
 * Floor, walls, ceiling and skirting. Deliberately simple geometry: the room is
 * a container for the books, and every triangle here is one the shelves do not
 * get to spend.
 */
export const Room = ({ width = 9, depth = 9, height = 3.4 }: RoomProps) => {
  const materials = useSharedMaterials();
  const halfW = width / 2;
  const halfD = depth / 2;

  /** [rotationY, position] for the back, front, left and right walls. */
  const walls: [number, [number, number, number], number][] = [
    [0, [0, height / 2, -halfD], width],
    [Math.PI, [0, height / 2, halfD], width],
    [Math.PI / 2, [-halfW, height / 2, 0], depth],
    [-Math.PI / 2, [halfW, height / 2, 0], depth],
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={materials.floor}>
        <planeGeometry args={[width, depth]} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]} material={materials.ceiling}>
        <planeGeometry args={[width, depth]} />
      </mesh>

      {walls.map(([rotationY, position, span], index) => (
        <group key={index}>
          <mesh
            position={position}
            rotation={[0, rotationY, 0]}
            receiveShadow
            material={materials.wall}
          >
            <planeGeometry args={[span, height]} />
          </mesh>
          <mesh
            position={[position[0], SKIRTING_H / 2, position[2]]}
            rotation={[0, rotationY, 0]}
            receiveShadow
            material={materials.woodDark}
          >
            <boxGeometry args={[span, SKIRTING_H, CASE_PANEL]} />
          </mesh>
          <mesh
            position={[position[0], height - CORNICE_H / 2, position[2]]}
            rotation={[0, rotationY, 0]}
            receiveShadow
            material={materials.woodMid}
          >
            <boxGeometry args={[span, CORNICE_H, CASE_PANEL * 1.6]} />
          </mesh>
        </group>
      ))}

      {/* Ceiling beams, running the width of the room. */}
      {Array.from({ length: Math.max(1, Math.floor(depth / BEAM_SPACING) - 1) }, (_, index) => (
        <mesh
          key={index}
          position={[0, height - 0.09, -halfD + BEAM_SPACING * (index + 1)]}
          castShadow
          receiveShadow
          material={materials.woodDark}
        >
          <boxGeometry args={[width, 0.18, 0.16]} />
        </mesh>
      ))}
    </group>
  );
};
