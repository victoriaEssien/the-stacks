import { useSharedMaterials } from '../materials/useSharedMaterials';

export interface WindowFrameProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
}

/**
 * A window onto a dusk sky. The wall behind it is opaque, so this is a frame
 * and a flat pane rather than a real opening - at this scale nothing gives that
 * away, and it costs two draw calls instead of a hole in the geometry.
 */
export const WindowFrame = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 1.2,
  height = 1.5,
}: WindowFrameProps) => {
  const materials = useSharedMaterials();
  const bar = 0.05;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.01]} material={materials.nightSky}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* Frame: two verticals, two horizontals, and a cross of glazing bars. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`v${side}`}
          position={[side * (width / 2), 0, 0.03]}
          castShadow
          material={materials.woodMid}
        >
          <boxGeometry args={[bar * 1.6, height + bar * 2, 0.06]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`h${side}`}
          position={[0, side * (height / 2), 0.03]}
          castShadow
          material={materials.woodMid}
        >
          <boxGeometry args={[width + bar * 2, bar * 1.6, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.02]} material={materials.woodMid}>
        <boxGeometry args={[bar * 0.7, height, 0.03]} />
      </mesh>
      <mesh position={[0, 0, 0.02]} material={materials.woodMid}>
        <boxGeometry args={[width, bar * 0.7, 0.03]} />
      </mesh>

      {/* Sill */}
      <mesh
        position={[0, -height / 2 - bar, 0.07]}
        castShadow
        receiveShadow
        material={materials.woodLight}
      >
        <boxGeometry args={[width + 0.18, 0.05, 0.16]} />
      </mesh>
    </group>
  );
};
