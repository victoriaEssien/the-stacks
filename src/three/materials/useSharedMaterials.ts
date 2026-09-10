import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from './palette';
import {
  duskSkyTexture,
  floorboardTexture,
  plasterTexture,
  woodTexture,
} from './proceduralTextures';

/**
 * Shared materials. Creating one material per mesh is the fastest way to make
 * a three.js scene slow - everything structural pulls from here instead.
 *
 * The maps are drawn once on a canvas (see `proceduralTextures`) and shared the
 * same way, so grain costs one texture per surface type rather than per mesh.
 */
export const useSharedMaterials = () => {
  return useMemo(() => {
    const wood = (color: string, repeat: number, roughness = 0.75) =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: woodTexture(color, repeat),
        // The colour map doubles as a bump map: the grain that reads darker is
        // the grain that sits lower.
        bumpMap: woodTexture(color, repeat),
        bumpScale: 0.22,
        roughness,
        metalness: 0.02,
      });

    return {
      woodDark: wood(PALETTE.woodDark, 1),
      woodMid: wood(PALETTE.woodMid, 1),
      woodLight: wood(PALETTE.woodLight, 1, 0.62),
      floor: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: floorboardTexture(PALETTE.floor),
        bumpMap: floorboardTexture(PALETTE.floor),
        bumpScale: 0.5,
        roughness: 0.82,
      }),
      rug: new THREE.MeshStandardMaterial({ color: PALETTE.rug, roughness: 1 }),
      rugTrim: new THREE.MeshStandardMaterial({ color: PALETTE.rugTrim, roughness: 1 }),
      wall: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: plasterTexture(PALETTE.wall),
        bumpMap: plasterTexture(PALETTE.wall),
        bumpScale: 0.2,
        roughness: 0.95,
      }),
      ceiling: new THREE.MeshStandardMaterial({ color: PALETTE.ceiling, roughness: 1 }),
      brass: new THREE.MeshStandardMaterial({
        color: PALETTE.brass,
        roughness: 0.28,
        metalness: 0.9,
      }),
      paper: new THREE.MeshStandardMaterial({ color: PALETTE.paper, roughness: 0.95 }),
      leather: new THREE.MeshStandardMaterial({ color: PALETTE.leather, roughness: 0.55 }),
      terracotta: new THREE.MeshStandardMaterial({ color: PALETTE.terracotta, roughness: 0.85 }),
      foliage: new THREE.MeshStandardMaterial({ color: PALETTE.foliage, roughness: 0.8 }),
      foliageDeep: new THREE.MeshStandardMaterial({ color: PALETTE.foliageDeep, roughness: 0.8 }),
      /** The view out of the window: dusk, not a light source of its own. */
      nightSky: new THREE.MeshBasicMaterial({ map: duskSkyTexture() }),
    };
  }, []);
};

export type SharedMaterials = ReturnType<typeof useSharedMaterials>;
