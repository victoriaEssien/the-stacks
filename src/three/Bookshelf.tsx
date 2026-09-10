import type { ReactNode } from 'react';
import { CASE_PANEL } from '@/utils/roomLayout';
import { DEFAULT_SHELF_CONFIG, shelfSurfaceY, type ShelfConfig } from '@/utils/shelfLayout';
import { useSharedMaterials } from './materials/useSharedMaterials';

export interface BookshelfProps {
  config?: ShelfConfig;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Books belonging to this case, already positioned in case-local space. */
  children?: ReactNode;
}

/**
 * A single bookcase. Its origin is the centre of its footprint, which is what
 * `layOutBooks` produces coordinates against.
 */
export const Bookshelf = ({
  config = DEFAULT_SHELF_CONFIG,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  children,
}: BookshelfProps) => {
  const materials = useSharedMaterials();
  const outerWidth = config.shelfWidth + CASE_PANEL * 2;
  const outerHeight = shelfSurfaceY(config.shelvesPerCase, config) + 0.06;
  const depth = config.shelfDepth;

  const shelfBoards = Array.from({ length: config.shelvesPerCase + 1 }, (_, index) => index);

  return (
    <group position={position} rotation={rotation}>
      {/* Sides */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (config.shelfWidth / 2 + CASE_PANEL / 2), outerHeight / 2, 0]}
          castShadow
          receiveShadow
          material={materials.woodDark}
        >
          <boxGeometry args={[CASE_PANEL, outerHeight, depth]} />
        </mesh>
      ))}

      {/* Back panel */}
      <mesh
        position={[0, outerHeight / 2, -depth / 2 + 0.01]}
        receiveShadow
        material={materials.woodMid}
      >
        <boxGeometry args={[outerWidth, outerHeight, 0.02]} />
      </mesh>

      {/* Top */}
      <mesh
        position={[0, outerHeight + CASE_PANEL / 2, 0]}
        castShadow
        material={materials.woodLight}
      >
        <boxGeometry args={[outerWidth + 0.05, CASE_PANEL, depth + 0.03]} />
      </mesh>

      {/* Shelf boards */}
      {shelfBoards.map((index) => (
        <mesh
          key={index}
          position={[0, shelfSurfaceY(index, config) - CASE_PANEL / 2, 0]}
          castShadow
          receiveShadow
          material={materials.woodLight}
        >
          <boxGeometry args={[config.shelfWidth, CASE_PANEL, depth]} />
        </mesh>
      ))}

      {children}
    </group>
  );
};
