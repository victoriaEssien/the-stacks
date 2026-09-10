import { useCallback, useEffect, useRef } from 'react';
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree, type EventManager } from '@react-three/fiber';
import * as THREE from 'three';
import { clampToRoom, moveWithCollisions } from '@/utils/collision';
import type { Footprint } from '@/utils/roomLayout';

export interface PlayerControlsProps {
  /** Controls stand down while a 2D overlay is open. */
  enabled?: boolean;
  speed?: number;
  eyeHeight?: number;
  /** The walls the player is kept inside. */
  room: { width: number; depth: number };
  /** Furniture the player cannot walk through. */
  obstacles?: readonly Footprint[];
  /** How wide the player is, for collision purposes. */
  radius?: number;
  /** Where the player starts. Applied once, on mount. */
  spawn?: { x: number; z: number };
  onLockChange?: (locked: boolean) => void;
  /** The browser refused to hand over the mouse. */
  onLockError?: () => void;
}

/**
 * Module-scoped scratch vectors. Allocating inside useFrame would churn the GC
 * 60 times a second; keeping them out of hooks also keeps the React Compiler
 * immutability rules happy.
 */
const direction = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

const NO_KEYS = { forward: false, back: false, left: false, right: false };

const KEY_MAP: Record<string, keyof typeof NO_KEYS> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/**
 * First-person WASD + pointer-lock navigation. Movement is frame-rate
 * independent, damped so the camera glides rather than snaps, and resolved
 * against the furniture so you cannot walk through a bookcase.
 */
export const PlayerControls = ({
  enabled = true,
  speed = 2.6,
  eyeHeight = 1.62,
  room,
  obstacles = [],
  radius = 0.34,
  spawn,
  onLockChange,
  onLockError,
}: PlayerControlsProps) => {
  const { camera } = useThree();
  const setEvents = useThree((state) => state.setEvents);
  const get = useThree((state) => state.get);
  const keys = useRef({ ...NO_KEYS });
  const velocity = useRef(new THREE.Vector3());
  const spawned = useRef(false);

  // Drop the player on a clear patch of floor. Only ever on the first frame -
  // the room deepening as books are added must not teleport anyone.
  useEffect(() => {
    if (!spawn || spawned.current) return;
    spawned.current = true;
    camera.position.set(spawn.x, eyeHeight, spawn.z);
  }, [camera, eyeHeight, spawn]);

  useEffect(() => {
    const setKey = (event: KeyboardEvent, value: boolean) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      keys.current[action] = value;
    };
    const onDown = (event: KeyboardEvent) => setKey(event, true);
    const onUp = (event: KeyboardEvent) => setKey(event, false);
    const onBlur = () => {
      keys.current = { ...NO_KEYS };
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /**
   * Hand the cursor back the moment a panel opens, and KEEP handing it back
   * until the panel closes.
   *
   * Releasing once is not enough. The very click that opens a panel is also the
   * click `PointerLockControls` locks on, and `requestPointerLock` resolves
   * asynchronously - so the lock lands a moment AFTER this effect has already
   * called `exitPointerLock`. The panel then sits there with the pointer
   * captured: there is no cursor to press its buttons with, and because a
   * locked canvas raycasts from the crosshair, every further click re-picks
   * whatever is at the centre of the screen - which is still the book that
   * opened the panel in the first place, so it opens again and again.
   *
   * Listening for the lock instead of assuming it is gone fixes that whatever
   * order the browser resolves things in.
   */
  useEffect(() => {
    if (enabled) return;
    keys.current = { ...NO_KEYS };
    velocity.current.set(0, 0, 0);

    const release = () => {
      if (document.pointerLockElement) document.exitPointerLock();
    };
    release();
    document.addEventListener('pointerlockchange', release);

    // The controls are unmounted below, so their own unlock event may never
    // arrive. Say so ourselves, or the HUD keeps drawing a crosshair.
    onLockChange?.(false);
    return () => document.removeEventListener('pointerlockchange', release);
  }, [enabled, onLockChange]);

  /**
   * Aim picking at whatever the reader is actually pointing at.
   *
   * `PointerLockControls` forces every raycast through the centre of the
   * screen. That is right while the pointer is locked and wrong the rest of the
   * time: the cursor is visible then, and clicking a book would open whichever
   * book happened to be under the crosshair instead.
   */
  const compute = useCallback<NonNullable<EventManager<HTMLElement>['compute']>>((event, state) => {
    if (document.pointerLockElement) {
      state.pointer.set(0, 0);
    } else {
      state.pointer.set(
        (event.offsetX / state.size.width) * 2 - 1,
        -(event.offsetY / state.size.height) * 2 + 1,
      );
    }
    state.raycaster.setFromCamera(state.pointer, state.camera);
  }, []);

  /**
   * Chrome refuses a lock requested too soon after the last one was released -
   * press Escape, click straight away, and nothing happens. Say so rather than
   * leaving the reader clicking a room that ignores them.
   */
  useEffect(() => {
    if (!onLockError) return;
    const onError = () => onLockError();
    document.addEventListener('pointerlockerror', onError);
    return () => document.removeEventListener('pointerlockerror', onError);
  }, [onLockError]);

  useFrame((_, rawDelta) => {
    /**
     * Keep our picking installed, rather than installing it once and hoping.
     *
     * `PointerLockControls` writes its own centre-screen `compute` from an
     * effect every time it connects, and restores whatever it found at mount
     * when it disconnects - so which of the two survives a panel opening and
     * closing comes down to the order React happens to run a parent's effect
     * and a remounting child's in. Betting on that was what left clicks landing
     * on the wrong book after a dialog closed. A reference comparison per frame
     * costs nothing and cannot be raced.
     */
    if (get().events.compute !== compute) setEvents({ compute });

    const delta = Math.min(rawDelta, 0.1);
    const { forward: f, back: b, left: l, right: r } = keys.current;

    direction.set(Number(r) - Number(l), 0, Number(b) - Number(f));
    const moving = enabled && direction.lengthSq() > 0;
    if (moving) direction.normalize();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    const acceleration = moving ? speed * 10 : 0;
    velocity.current.x += (right.x * direction.x - forward.x * direction.z) * acceleration * delta;
    velocity.current.z += (right.z * direction.x - forward.z * direction.z) * acceleration * delta;
    velocity.current.multiplyScalar(Math.exp(-9 * delta));

    const from = { x: camera.position.x, z: camera.position.z };
    const wanted = clampToRoom(
      { x: from.x + velocity.current.x * delta, z: from.z + velocity.current.z * delta },
      room,
      radius,
    );
    const next = moveWithCollisions(from, wanted, obstacles, radius);

    // Kill the velocity on any axis that was refused, so momentum does not
    // build up against a shelf and fling the camera when the player turns away.
    if (next.x !== wanted.x) velocity.current.x = 0;
    if (next.z !== wanted.z) velocity.current.z = 0;

    camera.position.set(next.x, eyeHeight, next.z);
  });

  /**
   * Unmounted, not merely disabled, whenever a panel is open.
   *
   * `PointerLockControls` registers a click-to-lock handler whose effect does
   * not depend on `enabled`, so leaving it mounted means every click inside a
   * dialog - into a text field, onto a star - takes the mouse away again. The
   * reader's only way back is Escape, which also closes the dialog and loses
   * what they typed.
   *
   * `selector` narrows that handler to the canvas as well, so clicking the HUD
   * does not grab the mouse either. Clicking the room still does, which is what
   * the on-screen hint promises.
   */
  return enabled ? (
    <PointerLockControls
      selector="canvas"
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  ) : null;
};
