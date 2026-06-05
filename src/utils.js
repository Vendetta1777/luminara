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
