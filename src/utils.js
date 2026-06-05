// utils.js — shared helper functions used across every system.
// Math helpers (lerp, clamp), camera shake, and other small utilities live here
// so logic is never duplicated between files.
//
// Milestone 5 will add camera shake here.

/**
 * Linear interpolation: returns the value `t` (0..1) of the way from `a` to `b`.
 * Used everywhere for smooth, eased motion (e.g. gliding toward the cursor).
 *   lerp(0, 10, 0.5) === 5
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Constrain `val` to the inclusive range [min, max].
 *   clamp(120, 0, 100) === 100
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Convert a "#rrggbb" hex color into an "rgba(r,g,b,a)" string so we can draw
 * it at any opacity — essential for the soft, fading gradient stops that make
 * the glow and trail look luminous. Used by the player, particles, and world.
 */
export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Frame-rate-independent smoothing factor. Given a per-16.67ms smoothing amount
 * (0..1) and the real elapsed `deltaTime` in ms, returns the fraction to lerp
 * this frame so easing feels identical at any refresh rate.
 */
export function smoothFactor(smoothing, deltaTime) {
  return 1 - Math.pow(1 - smoothing, deltaTime / 16.6667);
}

/**
 * Linearly blend two "#rrggbb" colors and return an "rgb(...)" string.
 * Used to fade the ocean gradient darker with depth.
 */
export function mixHex(a, b, t) {
  const ah = a.replace('#', ''), bh = b.replace('#', '');
  const ar = parseInt(ah.substring(0, 2), 16), ag = parseInt(ah.substring(2, 4), 16), ab = parseInt(ah.substring(4, 6), 16);
  const br = parseInt(bh.substring(0, 2), 16), bg = parseInt(bh.substring(2, 4), 16), bb = parseInt(bh.substring(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Pre-render a soft radial glow into an offscreen canvas ONCE, so it can be
 * stamped cheaply with drawImage every frame. This replaces per-frame
 * shadowBlur + createRadialGradient, which are far too slow at scale.
 * Returns a canvas: a white-hot core fading through `color` to transparent.
 */
export function createGlowSprite(color, diameter = 64) {
  const c = document.createElement('canvas');
  c.width = diameter;
  c.height = diameter;
  const g = c.getContext('2d');
  const r = diameter / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, hexToRgba('#ffffff', 1));
  grad.addColorStop(0.3, hexToRgba(color, 0.85));
  grad.addColorStop(1.0, hexToRgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, diameter, diameter);
  return c;
}
