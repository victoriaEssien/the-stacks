import { seededRange, seededUnit } from '@/utils/hash';
import { useSharedMaterials } from '../materials/useSharedMaterials';

export interface PlantProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Same seed, same plant - it never reshuffles between renders. */
  seed?: string;
  scale?: number;
}

const CLUMPS = 5;

/** A potted plant. Foliage is a handful of low-poly clumps rather than a mesh
 *  with thousands of leaves. */
export const Plant = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  seed = 'plant',
  scale = 1,
}: PlantProps) => {
  const materials = useSharedMaterials();

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow material={materials.terracotta}>
        <cylinderGeometry args={[0.17, 0.13, 0.34, 16]} />
      </mesh>
      <mesh position={[0, 0.345, 0]} material={materials.terracotta}>
        <cylinderGeometry args={[0.185, 0.185, 0.05, 16]} />
      </mesh>

      {Array.from({ length: CLUMPS }, (_, index) => {
        const angle = (index / CLUMPS) * Math.PI * 2 + seededUnit(seed, 'spin') * Math.PI;
        const spread = seededRange(seed, `r${index}`, 0.1, 0.2);
        const height = seededRange(seed, `h${index}`, 0.5, 0.78);
        const size = seededRange(seed, `s${index}`, 0.14, 0.2);
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * spread, height, Math.sin(angle) * spread]}
            castShadow
            material={index % 2 === 0 ? materials.foliage : materials.foliageDeep}
          >
            <icosahedronGeometry args={[size, 0]} />
          </mesh>
        );
      })}
    </group>
  );
};
