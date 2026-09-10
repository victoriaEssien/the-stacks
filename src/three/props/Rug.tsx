import { useSharedMaterials } from '../materials/useSharedMaterials';

export interface RugProps {
  position?: [number, number, number];
  radius?: number;
}

/** Sits flat on the floor under the desk. Two discs, so it has a border. */
export const Rug = ({ position = [0, 0, 0], radius = 1.9 }: RugProps) => {
  const materials = useSharedMaterials();
  const [x, , z] = position;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, z]} material={materials.rugTrim}>
        <circleGeometry args={[radius, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, z]} material={materials.rug}>
        <circleGeometry args={[radius - 0.14, 48]} />
      </mesh>
    </group>
  );
};
