import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hashString } from '@/utils/hash';

/**
 * A small PRNG, seeded once and stepped per value.
 *
 * Hashing `dust0`, `dust1`, ... and reading each axis off the result correlates
 * across neighbouring indices, which lays the cloud out along a visible
 * diagonal. Stepping one generator does not, and is still deterministic.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface DustMotesProps {
  /** Centre of the volume the dust drifts in. */
  position?: [number, number, number];
  size?: [number, number, number];
  count?: number;
  reducedMotion?: boolean;
}

/**
 * Dust hanging in the lamplight. One draw call for the lot, and the only thing
 * in the room that moves on its own - a completely still room reads as a
 * screenshot.
 */
export const DustMotes = ({
  position = [0, 1.2, 0],
  size = [3, 2, 3],
  count = 130,
  reducedMotion = false,
}: DustMotesProps) => {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, drift, phase } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const random = mulberry32(hashString('dust'));
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.5) * size[0];
      positions[i * 3 + 1] = (random() - 0.5) * size[1];
      positions[i * 3 + 2] = (random() - 0.5) * size[2];
      speeds[i] = 0.003 + random() * 0.009;
      // Each mote needs its OWN sway phase. Deriving it from the index instead
      // marches the whole cloud through a sine wave in lockstep, which reads as
      // a swarm of gnats rather than dust.
      phases[i] = random() * Math.PI * 2;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: buffer, drift: speeds, phase: phases };
  }, [count, size]);

  useFrame((state, delta) => {
    if (reducedMotion || !pointsRef.current) return;
    const attribute = pointsRef.current.geometry.getAttribute('position');
    const array = attribute.array as Float32Array;
    const time = state.clock.elapsedTime;
    const top = size[1] / 2;

    for (let i = 0; i < drift.length; i += 1) {
      const y = i * 3 + 1;
      array[y] = (array[y] ?? 0) + (drift[i] ?? 0) * delta * 12;
      if ((array[y] ?? 0) > top) array[y] = -top;
      // A touch of lateral sway, so it floats rather than rises like smoke.
      array[i * 3] = (array[i * 3] ?? 0) + Math.sin(time * 0.4 + (phase[i] ?? 0)) * delta * 0.004;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.008}
        color="#ffe6bd"
        transparent
        opacity={0.32}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};
