import * as THREE from 'three';
import { hashString } from '@/utils/hash';

/**
 * Surface texture, drawn at runtime on a 2D canvas.
 *
 * Flat untinted colour is what makes a room read as "a three.js demo" - real
 * wood has grain, real plaster has tooth. Generating the maps here keeps the
 * repo asset-free and the download small, and 256-512px is ample for surfaces
 * nobody puts their nose against.
 */

const TEXTURES = new Map<string, THREE.Texture>();

const canvasFor = (size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

const finish = (canvas: HTMLCanvasElement, repeat: number, srgb: boolean): THREE.Texture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** Deterministic pseudo-random, so a surface looks the same every reload. */
const rand = (seed: string, n: number) => (hashString(`${seed}:${n}`) % 10000) / 10000;

/**
 * Wood grain: long fibres along one axis, a little cross-grain wobble, and the
 * occasional knot.
 */
const drawWood = (context: CanvasRenderingContext2D, size: number, base: string, seed: string) => {
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 95; i += 1) {
    const y = rand(seed, i) * size;
    const light = rand(seed, i + 500) > 0.5;
    context.strokeStyle = light ? 'rgba(255,235,205,0.028)' : 'rgba(30,16,8,0.04)';
    context.lineWidth = 0.6 + rand(seed, i + 900) * 1.8;
    context.beginPath();
    context.moveTo(0, y);

    // Grain runs nearly parallel. Two low harmonics at unrelated phases keep
    // the drift from reading as a regular wave, which is what a single
    // high-frequency sine looks like once it is tiled across a shelf.
    const amp = 1 + rand(seed, i + 1300) * 3;
    const f1 = 1 + rand(seed, i + 1700) * 1.2;
    const f2 = 2 + rand(seed, i + 2100) * 1.8;
    const phase = rand(seed, i + 2500) * Math.PI * 2;
    for (let x = 0; x <= size; x += 8) {
      const u = (x / size) * Math.PI * 2;
      context.lineTo(
        x,
        y + Math.sin(u * f1 + phase) * amp + Math.sin(u * f2 + phase * 1.7) * amp * 0.4,
      );
    }
    context.stroke();
  }

  for (let k = 0; k < 3; k += 1) {
    const cx = rand(seed, k + 40) * size;
    const cy = rand(seed, k + 70) * size;
    for (let r = 10; r > 0; r -= 1) {
      context.strokeStyle = `rgba(40,22,10,${0.02 + r * 0.004})`;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(cx, cy, r * 1.6, r * 0.9, rand(seed, k) * Math.PI, 0, Math.PI * 2);
      context.stroke();
    }
  }
};

/** A single sheet of wood, for shelves, the desk and bookcase panels. */
export const woodTexture = (base: string, repeat = 1, seed = base): THREE.Texture => {
  const key = `wood:${base}:${repeat}:${seed}`;
  const existing = TEXTURES.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = canvasFor(size);
  const context = canvas.getContext('2d')!;
  drawWood(context, size, base, seed);

  const texture = finish(canvas, repeat, true);
  TEXTURES.set(key, texture);
  return texture;
};

/** Floorboards: planks with seams, each plank grained slightly differently. */
export const floorboardTexture = (base: string, planks = 8, repeat = 2.5): THREE.Texture => {
  const key = `floor:${base}:${planks}:${repeat}`;
  const existing = TEXTURES.get(key);
  if (existing) return existing;

  const size = 512;
  const canvas = canvasFor(size);
  const context = canvas.getContext('2d')!;
  drawWood(context, size, base, `${base}-floor`);

  const plankHeight = size / planks;
  for (let i = 0; i <= planks; i += 1) {
    const y = i * plankHeight;
    context.fillStyle = 'rgba(18,10,5,0.55)';
    context.fillRect(0, y - 1, size, 2);
    context.fillStyle = 'rgba(255,230,195,0.05)';
    context.fillRect(0, y + 1, size, 1);

    // Stagger the short joints between boards.
    const joint = rand(base, i) * size;
    context.fillStyle = 'rgba(18,10,5,0.45)';
    context.fillRect(joint, y, 2, plankHeight);
  }

  const texture = finish(canvas, repeat, true);
  TEXTURES.set(key, texture);
  return texture;
};

/**
 * Plaster: fine tooth plus a slow, soft variation.
 *
 * Everything here is built from `sin` over the full tile, so the texture is
 * seamless by construction. Blotches drawn at arbitrary positions do not wrap,
 * and at any repeat above 1 their cut-off edges line up into a visible grid -
 * which reads as brickwork, not a wall.
 */
export const plasterTexture = (base: string): THREE.Texture => {
  const key = `plaster:${base}`;
  const existing = TEXTURES.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = canvasFor(size);
  const context = canvas.getContext('2d')!;
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  const image = context.getImageData(0, 0, size, size);
  const { data } = image;
  const tau = Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * tau;
      const v = (y / size) * tau;

      // Two periodic harmonics for slow variation, plus per-pixel tooth.
      const slow =
        Math.sin(u) * Math.sin(v * 2) * 2 + Math.sin(u * 3 + 1.1) * Math.sin(v + 0.4) * 1.3;
      const tooth = ((hashString(`${x},${y}`) % 255) / 255 - 0.5) * 7;
      const shift = slow + tooth;

      const i = (y * size + x) * 4;
      data[i] = (data[i] ?? 0) + shift;
      data[i + 1] = (data[i + 1] ?? 0) + shift * 0.95;
      data[i + 2] = (data[i + 2] ?? 0) + shift * 0.85;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = finish(canvas, 4, true);
  TEXTURES.set(key, texture);
  return texture;
};

/** A dusk sky for the window: gradient, a moon, a scatter of stars. */
export const duskSkyTexture = (): THREE.Texture => {
  const key = 'sky';
  const existing = TEXTURES.get(key);
  if (existing) return existing;

  const width = 256;
  const height = 320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#101a2c');
  gradient.addColorStop(0.55, '#26364d');
  gradient.addColorStop(1, '#5a5570');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 60; i += 1) {
    const y = rand('stars', i + 300) * height * 0.7;
    context.fillStyle = `rgba(255,250,235,${0.15 + rand('stars', i) * 0.5})`;
    context.fillRect(rand('stars', i + 100) * width, y, 1.4, 1.4);
  }

  const moon = context.createRadialGradient(190, 70, 4, 190, 70, 44);
  moon.addColorStop(0, 'rgba(255,248,225,0.95)');
  moon.addColorStop(0.25, 'rgba(255,244,215,0.35)');
  moon.addColorStop(1, 'rgba(255,244,215,0)');
  context.fillStyle = moon;
  context.fillRect(120, 0, 150, 150);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  TEXTURES.set(key, texture);
  return texture;
};
