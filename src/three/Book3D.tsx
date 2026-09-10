import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Book } from '@/models';
import { authorLine } from '@/models';
import { textureCoverCandidates } from '@/services/books';
import { seededUnit } from '@/utils/hash';
import type { BookPlacement } from '@/utils/shelfLayout';
import { PALETTE } from './materials/palette';
import { useCoverColor } from './materials/useCoverColor';
import { useCoverTexture } from './materials/useCoverTexture';

export interface Book3DProps {
  book: Book;
  placement: BookPlacement;
  isSelected?: boolean;
  onSelect?: (bookId: string) => void;
  onHover?: (bookId: string | undefined) => void;
  /** Set on freshly added books so they can animate onto the shelf. */
  animateIn?: boolean;
  reducedMotion?: boolean;
}

/** How far a hovered or selected book eases out of the shelf. */
const NUDGE = 0.03;

/**
 * A physical book, standing COVER-OUT the way a bookshop faces its stock.
 *
 * BoxGeometry material order is [+x, -x, +y, -y, +z, -z]. The cover faces +z,
 * out into the room; the boards and page block take the other five faces.
 *
 * Nothing here draws text: the cover already carries the title, whether it came
 * from a provider or from `generatedCover`. That keeps a book down to a single
 * mesh, which is what makes a wall of them affordable.
 */
export const Book3D = ({
  book,
  placement,
  isSelected = false,
  onSelect,
  onHover,
  animateIn = false,
  reducedMotion = false,
}: Book3DProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  /** Entry progress, 0 -> 1. A ref, not state: this changes every frame and
   *  must not re-render React. */
  const entry = useRef(animateIn && !reducedMotion ? 0 : 1);

  const { width, height, depth } = placement.dimensions;
  const cover = useCoverTexture(
    textureCoverCandidates(book),
    book.title,
    authorLine(book),
    book.id,
  );

  const hashedColor = useMemo(() => {
    const index = Math.floor(seededUnit(book.id, 'spine') * PALETTE.bookSpines.length);
    return PALETTE.bookSpines[index] ?? PALETTE.bookSpines[0];
  }, [book.id]);

  // The binding, sampled from the jacket so the edges of the book agree with
  // its cover instead of being a random swatch.
  const bindingColor = useCoverColor(cover, hashedColor);

  const materials = useMemo(() => {
    const front = new THREE.MeshStandardMaterial({
      color: cover ? '#ffffff' : bindingColor,
      map: cover ?? null,
      roughness: 0.66,
    });
    const binding = new THREE.MeshStandardMaterial({ color: bindingColor, roughness: 0.72 });
    const pages = new THREE.MeshStandardMaterial({ color: '#e7dcc2', roughness: 0.95 });
    return {
      unique: [front, binding, pages],
      // [+x, -x, +y, -y, +z, -z]
      faces: [pages, binding, pages, pages, front, binding],
    };
  }, [cover, bindingColor]);

  // A new cover swaps the material array; the old one has to go back to the
  // GPU. The TEXTURE is shared and cached, so it is never disposed here - only
  // the materials this component made.
  useEffect(() => {
    const { unique } = materials;
    return () => {
      for (const material of unique) material.dispose();
    };
  }, [materials]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const restZ = placement.position[2];
    const target = restZ + (hovered || isSelected ? NUDGE : 0);

    // Subtle slide-and-settle when a book is first added.
    if (entry.current < 1) {
      entry.current = Math.min(1, entry.current + delta * 1.6);
      const eased = 1 - Math.pow(1 - entry.current, 3);
      group.position.z = restZ + (1 - eased) * 0.22;
      group.scale.setScalar(0.9 + eased * 0.1);
      return;
    }

    group.position.z = reducedMotion
      ? target
      : THREE.MathUtils.damp(group.position.z, target, 8, delta);
  });

  const highlighted = hovered || isSelected;

  return (
    <group
      ref={groupRef}
      position={placement.position}
      rotation={placement.rotation}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHover?.(book.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHovered(false);
        onHover?.(undefined);
        document.body.style.cursor = 'auto';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(book.id);
      }}
    >
      <mesh castShadow receiveShadow material={materials.faces}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>

      {highlighted && (
        <mesh position={[0, 0, depth / 2 + 0.003]}>
          <planeGeometry args={[width * 1.04, height * 1.03]} />
          <meshBasicMaterial
            color="#ffd9a0"
            transparent
            opacity={isSelected ? 0.28 : 0.16}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};
