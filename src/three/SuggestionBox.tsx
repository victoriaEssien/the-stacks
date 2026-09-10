import { useEffect, useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSharedMaterials } from './materials/useSharedMaterials';

export interface SuggestionBoxProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Count shown on the little card, so the box feels alive. */
  suggestionCount?: number;
  /**
   * Changes whenever a suggestion is submitted. Watching a token rather than
   * the count means the note still drops if one is added and another removed.
   */
  noteToken?: number;
  reducedMotion?: boolean;
  onOpen?: () => void;
}

const DROP_FROM = 0.42;
const SLOT_Y = 0.08;

/** A physical mailbox on a stand. Clicking it opens the suggestions overlay. */
export const SuggestionBox = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  suggestionCount = 0,
  noteToken = 0,
  reducedMotion = false,
  onOpen,
}: SuggestionBoxProps) => {
  const materials = useSharedMaterials();
  const groupRef = useRef<THREE.Group>(null);
  const noteRef = useRef<THREE.Group>(null);
  const drop = useRef(1);
  const [hovered, setHovered] = useState(false);
  const [dropping, setDropping] = useState(false);

  // A submitted suggestion posts a note into the slot.
  useEffect(() => {
    if (noteToken === 0 || reducedMotion) return;
    drop.current = 0;
    setDropping(true);
  }, [noteToken, reducedMotion]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (group) {
      const target = hovered ? 1.03 : 1;
      const next = reducedMotion ? target : THREE.MathUtils.damp(group.scale.x, target, 8, delta);
      group.scale.setScalar(next);
    }

    if (drop.current < 1) {
      drop.current = Math.min(1, drop.current + delta * 1.15);
      const eased = drop.current * drop.current;
      const note = noteRef.current;
      if (note) {
        note.position.y = SLOT_Y + (1 - eased) * DROP_FROM;
        note.rotation.z = (1 - eased) * 0.5;
        note.scale.setScalar(1 - eased * 0.25);
      }
      if (drop.current >= 1) setDropping(false);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Stand */}
      <mesh position={[0, 0.45, 0]} castShadow material={materials.woodDark}>
        <cylinderGeometry args={[0.045, 0.06, 0.9, 12]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow material={materials.woodDark}>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 16]} />
      </mesh>

      <group
        ref={groupRef}
        position={[0, 1.02, 0]}
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
        onClick={(event) => {
          event.stopPropagation();
          onOpen?.();
        }}
      >
        <mesh castShadow receiveShadow material={materials.brass}>
          <boxGeometry args={[0.34, 0.26, 0.26]} />
        </mesh>
        {/* Lid, so it reads as a box that opens. */}
        <mesh position={[0, 0.14, 0]} castShadow material={materials.woodDark}>
          <boxGeometry args={[0.36, 0.03, 0.28]} />
        </mesh>
        {/* Slot */}
        <mesh position={[0, SLOT_Y, 0.132]}>
          <planeGeometry args={[0.22, 0.02]} />
          <meshStandardMaterial color="#171310" roughness={1} />
        </mesh>
        <Text
          position={[0, -0.04, 0.132]}
          fontSize={0.032}
          color="#2b2118"
          anchorX="center"
          anchorY="middle"
        >
          {suggestionCount > 0 ? `${suggestionCount} notes` : 'suggest'}
        </Text>

        {hovered && (
          <mesh position={[0, 0, 0.134]}>
            <planeGeometry args={[0.33, 0.25]} />
            <meshBasicMaterial color="#ffd9a0" transparent opacity={0.1} />
          </mesh>
        )}

        {dropping && (
          <group ref={noteRef} position={[0, SLOT_Y + DROP_FROM, 0.14]}>
            <mesh material={materials.paper}>
              <planeGeometry args={[0.16, 0.11]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};
