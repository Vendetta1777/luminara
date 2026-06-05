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
