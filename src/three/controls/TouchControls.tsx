import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clampToRoom, moveWithCollisions } from '@/utils/collision';
import type { Footprint } from '@/utils/roomLayout';
import {
  clampPitch,
  DRAG_SLOP_PX,
  fovForPinch,
  lookSensitivity,
  restingFov,
  spanBetween,
  travelBetween,
  type Point2D,
} from '@/utils/touchGestures';
import type { TouchNavState } from './touchNav';

export interface TouchControlsProps {
  /** Controls stand down while a 2D overlay is open. */
  enabled?: boolean;
  eyeHeight?: number;
  /** The walls the reader is kept inside. */
  room: { width: number; depth: number };
  /** Furniture the reader cannot walk through. */
  obstacles?: readonly Footprint[];
  /** How wide the reader is, for collision purposes. */
  radius?: number;
  /** Where the reader starts. Applied once, on mount. */
  spawn?: { x: number; z: number };
  /** Shared with whatever the reader can tap to walk to. */
  nav: RefObject<TouchNavState>;
  reducedMotion?: boolean;
}

/** Walking pace, metres per second. Matches `PlayerControls`. */
const WALK_SPEED = 3.2;
/** Close enough to have arrived. */
const ARRIVE_EPSILON = 0.1;
/** How sharply the glide eases into its destination. */
const ARRIVE_DAMPING = 3.4;
/** Less movement than this in a frame means a bookcase is in the way. */
const STUCK_EPSILON = 1e-4;

/** Module-scoped scratch, so a gesture does not allocate 60 times a second. */
const scratch: Point2D = { x: 0, y: 0 };

/**
 * The touch way around the room.
 *
 * Pointer lock is the one thing on a phone that genuinely cannot work, and it
 * is the only thing `PlayerControls` really needs a mouse for - so this is a
 * sibling of it rather than a rewrite. Collision, the room plan and the shelf
 * layout are all pure and do not care what is driving the camera.
 *
 *   drag   look around, from where you are standing
 *   tap    anywhere in the room to walk there, a book to open it
 *   pinch  lean in, so a spine is readable without walking into the shelf
 *
 * Deliberately no on-screen joystick: it fills a quarter of a small screen with
 * the one thing on it that is not the library.
 */
export const TouchControls = ({
  enabled = true,
  eyeHeight = 1.62,
  room,
  obstacles = [],
  radius = 0.34,
  spawn,
  nav,
  reducedMotion = false,
}: TouchControlsProps) => {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const domElement = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const viewportWidth = size.width;
  /** What the lens returns to when the reader is not pinching. */
  const resting = restingFov(size.width / Math.max(1, size.height));

  /** Where the head is pointing. YXZ so yaw and pitch stay independent. */
  const look = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const pointers = useRef(new Map<number, Point2D>());
  const gestureStart = useRef<Point2D>({ x: 0, y: 0 });
  const pinch = useRef<{ span: number; fov: number } | null>(null);
  const spawned = useRef(false);

  /** The ring dropped where the reader tapped, and how much of it is left. */
  const ringRef = useRef<THREE.Mesh>(null);
  const ringLife = useRef(0);
  const shownDestination = useRef<TouchNavState['destination']>(null);

  // A phone held upright needs a wider lens than a laptop, and re-widens when
  // it is turned on its side. Pinching only ever narrows from here.
  useEffect(() => {
    camera.fov = resting;
    camera.updateProjectionMatrix();
  }, [camera, resting]);

  // Drop the reader on a clear patch of floor, facing the way the camera was
  // already looking. Only ever on the first frame - the room deepening as books
  // are added must not teleport anyone.
  useEffect(() => {
    if (spawned.current) return;
    spawned.current = true;
    look.current.setFromQuaternion(camera.quaternion);
    if (spawn) camera.position.set(spawn.x, eyeHeight, spawn.z);
  }, [camera, eyeHeight, spawn]);

  // Let go of everything the moment a panel opens: a finger lifted over a
  // dialog never sends its pointerup here.
  useEffect(() => {
    if (enabled) return;
    pointers.current.clear();
    pinch.current = null;
    nav.current.destination = null;
  }, [enabled, nav]);

  useEffect(() => {
    if (!enabled) return;
    const sensitivity = lookSensitivity(viewportWidth);

    const onDown = (event: PointerEvent) => {
      domElement.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size === 1) {
        // A fresh sequence is a tap until it proves otherwise.
        nav.current.dragged = false;
        gestureStart.current = { x: event.clientX, y: event.clientY };
        return;
      }
      // A second finger is never a tap.
      nav.current.dragged = true;
      pinch.current = { span: spanBetween(pointers.current.values()), fov: camera.fov };
    };

    const onMove = (event: PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      previous.x = event.clientX;
      previous.y = event.clientY;

      if (pointers.current.size >= 2) {
        const start = pinch.current;
        if (!start) return;
        camera.fov = fovForPinch(
          start.fov,
          start.span,
          spanBetween(pointers.current.values()),
          resting,
        );
        camera.updateProjectionMatrix();
        return;
      }

      // Under the slop the finger has not committed to anything, and turning
      // the room by a pixel or two would make every tap feel unsteady.
      if (!nav.current.dragged) {
        scratch.x = event.clientX;
        scratch.y = event.clientY;
        if (travelBetween(gestureStart.current, scratch) <= DRAG_SLOP_PX) return;
        nav.current.dragged = true;
      }

      look.current.y -= dx * sensitivity;
      look.current.x = clampPitch(look.current.x - dy * sensitivity);
    };

    const onRelease = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      // `dragged` deliberately survives: the click the browser is about to
      // synthesise has to be able to see it.
    };

    domElement.addEventListener('pointerdown', onDown);
    domElement.addEventListener('pointermove', onMove);
    domElement.addEventListener('pointerup', onRelease);
    domElement.addEventListener('pointercancel', onRelease);
    return () => {
      domElement.removeEventListener('pointerdown', onDown);
      domElement.removeEventListener('pointermove', onMove);
      domElement.removeEventListener('pointerup', onRelease);
      domElement.removeEventListener('pointercancel', onRelease);
    };
  }, [camera, domElement, enabled, nav, resting, viewportWidth]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    camera.quaternion.setFromEuler(look.current);

    const destination = nav.current.destination;

    // A new destination drops a ring on the floor, so the tap is visibly the
    // thing that caused the walk.
    if (destination !== shownDestination.current) {
      shownDestination.current = destination;
      if (destination && ringRef.current) {
        ringRef.current.position.set(destination.x, 0.02, destination.z);
        ringLife.current = 1;
      }
    }

    const ring = ringRef.current;
    if (ring && ringLife.current > 0) {
      ringLife.current = Math.max(0, ringLife.current - delta * 1.3);
      (ring.material as THREE.MeshBasicMaterial).opacity = ringLife.current * 0.55;
      ring.scale.setScalar(1.35 - ringLife.current * 0.35);
      ring.visible = ringLife.current > 0;
    }

    if (!destination) return;

    const from = { x: camera.position.x, z: camera.position.z };
    const remaining = Math.hypot(destination.x - from.x, destination.z - from.z);
    if (remaining < ARRIVE_EPSILON) {
      nav.current.destination = null;
      return;
    }

    // Eases out over the last metre or so, but never travels faster than a
    // walk - otherwise a tap across the room starts as a lurch.
    const eased = reducedMotion ? remaining : remaining * (1 - Math.exp(-ARRIVE_DAMPING * delta));
    const scale = Math.min(eased, WALK_SPEED * delta) / remaining;

    const wanted = clampToRoom(
      {
        x: from.x + (destination.x - from.x) * scale,
        z: from.z + (destination.z - from.z) * scale,
      },
      room,
      radius,
    );
    const next = moveWithCollisions(from, wanted, obstacles, radius);
    camera.position.set(next.x, eyeHeight, next.z);

    // Something is in the way. Give up rather than grinding against it for as
    // long as the destination stands.
    if (Math.hypot(next.x - from.x, next.z - from.z) < STUCK_EPSILON) {
      nav.current.destination = null;
    }
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.2, 0.28, 32]} />
      <meshBasicMaterial color="#e2bd74" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};
