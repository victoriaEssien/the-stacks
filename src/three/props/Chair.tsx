import { useSharedMaterials } from '../materials/useSharedMaterials';

export interface ChairProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const SEAT_H = 0.42;
const SEAT_W = 0.56;
const SEAT_D = 0.52;

/** A low leather reading chair. Simple boxes - it reads at a glance and costs
 *  almost nothing to draw. */
export const Chair = ({ position = [0, 0, 0], rotation = [0, 0, 0] }: ChairProps) => {
  const materials = useSharedMaterials();

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, SEAT_H, 0]} castShadow receiveShadow material={materials.leather}>
        <boxGeometry args={[SEAT_W, 0.13, SEAT_D]} />
      </mesh>

      {/* Back */}
      <mesh
        position={[0, SEAT_H + 0.34, -SEAT_D / 2 + 0.06]}
        rotation={[-0.12, 0, 0]}
        castShadow
        receiveShadow
        material={materials.leather}
      >
        <boxGeometry args={[SEAT_W, 0.62, 0.11]} />
      </mesh>

      {/* Arms */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (SEAT_W / 2 - 0.03), SEAT_H + 0.16, 0.02]}
          castShadow
          material={materials.leather}
        >
          <boxGeometry args={[0.09, 0.19, SEAT_D * 0.82]} />
        </mesh>
      ))}

      {/* Legs */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], index) => (
        <mesh
          key={index}
          position={[sx! * (SEAT_W / 2 - 0.07), SEAT_H / 2 - 0.03, sz! * (SEAT_D / 2 - 0.07)]}
          castShadow
          material={materials.woodDark}
        >
          <boxGeometry args={[0.05, SEAT_H - 0.06, 0.05]} />
        </mesh>
      ))}
    </group>
  );
};
