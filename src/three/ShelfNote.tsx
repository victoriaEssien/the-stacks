import { Text } from '@react-three/drei';
import { useSharedMaterials } from './materials/useSharedMaterials';

export interface ShelfNoteProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  title: string;
  body: string;
}

/**
 * A small card propped on an empty shelf. The 3D equivalent of an empty state -
 * a first-time visitor should never be looking at bare wood with no idea what
 * to do (spec section 17, agent instruction 12).
 */
export const ShelfNote = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  title,
  body,
}: ShelfNoteProps) => {
  const materials = useSharedMaterials();

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow material={materials.paper}>
        <boxGeometry args={[0.42, 0.28, 0.008]} />
      </mesh>
      <Text
        position={[0, 0.07, 0.006]}
        fontSize={0.038}
        maxWidth={0.36}
        textAlign="center"
        color="#3b2a1d"
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      <Text
        position={[0, -0.04, 0.006]}
        fontSize={0.024}
        maxWidth={0.34}
        lineHeight={1.3}
        textAlign="center"
        color="#6b5540"
        anchorX="center"
        anchorY="middle"
      >
        {body}
      </Text>
    </group>
  );
};
