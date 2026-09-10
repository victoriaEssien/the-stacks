import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';

export interface LibraryCanvasProps {
  children: ReactNode;
  /**
   * Phone and tablet GPUs. They pair a high device pixel ratio with a fraction
   * of the fill rate, so the same scene at the same dpr costs several times as
   * much - and the battery is not plugged in.
   */
  lowPower?: boolean;
  /**
   * Stop drawing. Set while a full-screen tab covers the room: the scene is
   * frozen anyway, and rendering an invisible static room sixty times a second
   * is a straight subtraction from a phone battery.
   */
  paused?: boolean;
}

/**
 * The single place three.js is configured. Everything performance-related that
 * applies scene-wide lives here.
 */
export const LibraryCanvas = ({
  children,
  lowPower = false,
  paused = false,
}: LibraryCanvasProps) => (
  <Canvas
    frameloop={paused ? 'never' : 'always'}
    // "percentage" is PCFShadowMap. The default, PCFSoftShadowMap, is
    // deprecated in three 0.185 and silently downgraded to this anyway.
    shadows="percentage"
    // Cap DPR: retina displays otherwise render 4x the pixels for no gain here.
    // A phone is capped harder still - a 3x screen at 1.75 is 27x the pixels of
    // a 1x one, and the room is dim and soft-edged enough not to miss them.
    dpr={lowPower ? [1, 1.25] : [1, 1.75]}
    camera={{ position: [0, 1.62, 3.2], fov: 62, near: 0.05, far: 60 }}
    // Multisampling is the first thing to go when fill rate is the budget.
    gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => {
      gl.setClearColor('#14100c');
    }}
  >
    <Suspense fallback={null}>
      {children}
      <Preload all />
    </Suspense>
    <AdaptiveDpr pixelated />
  </Canvas>
);
