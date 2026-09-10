/**
 * Whether this browser can actually give us a WebGL context. The 3D room is an
 * enhancement, never the only way in (spec section 16) - when this is false the
 * app routes to list mode instead of rendering a black canvas.
 */
export const isWebGLAvailable = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
};
