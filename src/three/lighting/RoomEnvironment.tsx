import { Environment, Lightformer } from '@react-three/drei';

/**
 * Something for the metal to reflect.
 *
 * PBR metal with no environment has nothing to mirror, so brass renders as flat
 * orange paint. These lightformers are baked into a tiny cubemap once - they
 * cost one 64px render and no downloaded asset, unlike an HDRI.
 */
export const RoomEnvironment = () => (
  <Environment resolution={64} frames={1}>
    {/* Warm pool where the desk lamp is. */}
    <Lightformer
      form="rect"
      intensity={2.4}
      color="#ffd9a3"
      position={[2, 2, 2]}
      scale={[4, 3, 1]}
    />
    {/* Cool counter-bounce from the window side. */}
    <Lightformer
      form="rect"
      intensity={0.9}
      color="#9fb8e8"
      position={[-4, 2, 1]}
      scale={[3, 4, 1]}
    />
    {/* Dim ceiling, so upward-facing surfaces are not pitch black. */}
    <Lightformer
      form="rect"
      intensity={0.5}
      color="#6b5a48"
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 5, 0]}
      scale={[8, 8, 1]}
    />
    {/* Floor bounce. */}
    <Lightformer
      form="rect"
      intensity={0.35}
      color="#4d3726"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3, 0]}
      scale={[8, 8, 1]}
    />
  </Environment>
);
