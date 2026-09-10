import { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Book } from '@/models';
import { authorLine } from '@/models';
import { textureCoverCandidates } from '@/services/books';
import { PALETTE } from './materials/palette';
import { useCoverTexture } from './materials/useCoverTexture';
import { useSharedMaterials } from './materials/useSharedMaterials';

export interface DeskProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** The book currently being read, laid on the desk. */
  currentBook?: Book;
  reducedMotion?: boolean;
  onSelectBook?: (bookId: string) => void;
}

const TOP_HEIGHT = 0.76;
const TOP_W = 1.5;
const TOP_D = 0.72;

/**
 * The book being read right now, lying face up with its real cover. Box faces
 * are [+x, -x, +y, -y, +z, -z], so the artwork goes on +y.
 */
const OpenBook = ({ book, onSelect }: { book: Book; onSelect?: (id: string) => void }) => {
  const [hovered, setHovered] = useState(false);
  const cover = useCoverTexture(
    textureCoverCandidates(book),
    book.title,
    authorLine(book),
    book.id,
  );

  const materials = useMemo(() => {
    const front = new THREE.MeshStandardMaterial({
      color: cover ? '#ffffff' : PALETTE.leather,
      map: cover ?? null,
      roughness: 0.68,
    });
    const edge = new THREE.MeshStandardMaterial({ color: '#e7dcc2', roughness: 0.95 });
    return { unique: [front, edge], faces: [edge, edge, front, edge, edge, edge] };
  }, [cover]);

  // The cached texture outlives this component; the materials do not.
  useEffect(() => {
    const { unique } = materials;
    return () => {
      for (const material of unique) material.dispose();
    };
  }, [materials]);

  return (
    <group
      position={[-0.3, TOP_HEIGHT + 0.05, 0.06]}
      rotation={[0, 0.22, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(book.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh castShadow receiveShadow material={materials.faces}>
        <boxGeometry args={[0.17, 0.045, 0.25]} />
      </mesh>

      {/* Bookmark ribbon, because someone is part-way through. */}
      <mesh position={[0.04, 0.023, 0.06]} rotation={[-Math.PI / 2, 0, 0.06]}>
        <planeGeometry args={[0.018, 0.2]} />
        <meshStandardMaterial color="#b8623f" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {hovered && (
        <mesh position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, 0.26]} />
          <meshBasicMaterial color="#ffd9a0" transparent opacity={0.16} />
        </mesh>
      )}
    </group>
  );
};

/** Reading desk with a lamp, a mug, and whatever is being read right now. */
export const Desk = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  currentBook,
  reducedMotion = false,
  onSelectBook,
}: DeskProps) => {
  const materials = useSharedMaterials();
  const lampRef = useRef<THREE.PointLight>(null);

  /**
   * A filament lamp is never perfectly steady. Two out-of-phase sine waves are
   * enough to suggest it without ever reading as a fault.
   */
  useFrame((state) => {
    const lamp = lampRef.current;
    if (!lamp || reducedMotion) return;
    const t = state.clock.elapsedTime;
    lamp.intensity = 2.4 + Math.sin(t * 2.3) * 0.12 + Math.sin(t * 7.1) * 0.05;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, TOP_HEIGHT, 0]} castShadow receiveShadow material={materials.woodLight}>
        <boxGeometry args={[TOP_W, 0.05, TOP_D]} />
      </mesh>

      {[
        [-TOP_W / 2 + 0.08, -TOP_D / 2 + 0.08],
        [TOP_W / 2 - 0.08, -TOP_D / 2 + 0.08],
        [-TOP_W / 2 + 0.08, TOP_D / 2 - 0.08],
        [TOP_W / 2 - 0.08, TOP_D / 2 - 0.08],
      ].map(([x, z], index) => (
        <mesh
          key={index}
          position={[x!, TOP_HEIGHT / 2, z!]}
          castShadow
          material={materials.woodDark}
        >
          <boxGeometry args={[0.07, TOP_HEIGHT, 0.07]} />
        </mesh>
      ))}

      {/* Lamp */}
      <group position={[TOP_W / 2 - 0.24, TOP_HEIGHT + 0.03, -0.16]}>
        <mesh castShadow material={materials.brass}>
          <cylinderGeometry args={[0.09, 0.11, 0.02, 20]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow material={materials.brass}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 12]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} castShadow>
          <coneGeometry args={[0.13, 0.16, 20, 1, true]} />
          <meshStandardMaterial
            color={PALETTE.brass}
            side={THREE.DoubleSide}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
        <pointLight
          ref={lampRef}
          position={[0, 0.28, 0]}
          intensity={2.4}
          distance={3}
          decay={2}
          color="#ffd9a3"
        />
      </group>

      {/* Mug */}
      <group position={[0.34, TOP_HEIGHT + 0.06, 0.18]}>
        <mesh castShadow material={materials.paper}>
          <cylinderGeometry args={[0.042, 0.036, 0.09, 16]} />
        </mesh>
        <mesh position={[0.05, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.paper}>
          <torusGeometry args={[0.025, 0.007, 8, 16]} />
        </mesh>
      </group>

      {currentBook ? (
        <OpenBook book={currentBook} onSelect={onSelectBook} />
      ) : (
        <Text
          position={[-0.3, TOP_HEIGHT + 0.03, 0.06]}
          rotation={[-Math.PI / 2, 0, 0.22]}
          fontSize={0.026}
          maxWidth={0.42}
          textAlign="center"
          color="#8d7f68"
          anchorX="center"
          anchorY="middle"
        >
          Nothing on the desk
        </Text>
      )}
    </group>
  );
};
