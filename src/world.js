// world.js — the ocean atmosphere backdrop.
// Drawn in SCREEN space (with parallax keyed to the camera) so it sits behind
// the gameplay world. Layers: a depth-darkening radial gradient, surface light
// rays that fade as you descend, distant parallax plankton, and a vignette
// overlay. Later biomes will swap the palette via this same structure.

import { clamp, hexToRgba, mixHex } from './utils.js';

const TAU = Math.PI * 2;

export class World {
  constructor() {
    // Distant plankton — normalized positions in a wrapping screen field.
    this.plankton = [];
    for (let i = 0; i < 40; i++) {
      this.plankton.push({
        bx: Math.random(),
        by: Math.random(),
        size: 0.6 + Math.random() * 1.4,
        bright: 0.08 + Math.random() * 0.18,
        drift: 0.5 + Math.random() * 1.0,
        phase: Math.random() * TAU,
      });
    }

    // Surface light rays.
    this.rays = [];
    for (let i = 0; i < 5; i++) {
      this.rays.push({
        xFrac: 0.12 + 0.18 * i + Math.random() * 0.04,
        width: 60 + Math.random() * 90,
        sway: Math.random() * TAU,
      });
    }
  }

  /** 0 (surface) .. 1 (deep abyss), from how far the camera has descended. */
  _depth(camera) {
    return clamp(camera.y / 2600, 0, 1);
  }

  /** Background layers, drawn before the camera transform. */
  drawBackground(ctx, camera, w, h) {
    const now = Date.now();
    const depth = this._depth(camera);

    // 1. Deep-ocean radial gradient that darkens with depth.
    const cx = w * 0.5, cy = h * 0.42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.7);
    g.addColorStop(0, mixHex('#0b1d33', '#040d18', depth));
    g.addColorStop(1, mixHex('#02060c', '#010307', depth));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 2. Surface light rays — strong near the surface, gone in the deep.
    const rayAlpha = (1 - depth) * 0.06;
    if (rayAlpha > 0.002) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const ray of this.rays) {
        const bx = ray.xFrac * w + Math.sin(now * 0.0002 + ray.sway) * 40 - camera.x * 0.05;
        ctx.save();
        ctx.translate(bx, -20);
        ctx.rotate(0.12);
        const len = h * 1.15;
        const grad = ctx.createLinearGradient(0, 0, 0, len);
        grad.addColorStop(0, hexToRgba('#9fdcff', rayAlpha));
        grad.addColorStop(0.7, hexToRgba('#9fdcff', rayAlpha * 0.3));
        grad.addColorStop(1, hexToRgba('#9fdcff', 0));
        ctx.fillStyle = grad;
        ctx.fillRect(-ray.width / 2, 0, ray.width, len);
        ctx.restore();
      }
      ctx.restore();
    }

    // 3. Distant plankton — slow upward drift + parallax (slower than foreground).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const par = 0.45;
    for (const p of this.plankton) {
      let sx = (p.bx * w - camera.x * par) % w;
      if (sx < 0) sx += w;
      let sy = (p.by * h - camera.y * par - now * 0.001 * p.drift * 20) % h;
      if (sy < 0) sy += h;
      const tw = p.bright * (0.6 + 0.4 * Math.sin(now * 0.001 + p.phase)) * (0.4 + 0.6 * (1 - depth));
      ctx.fillStyle = hexToRgba('#bfe9ff', tw);
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Foreground overlay (vignette), drawn on top of everything but the HUD. */
  drawOverlay(ctx, w, h) {
    const g = ctx.createRadialGradient(
      w * 0.5, h * 0.45, Math.min(w, h) * 0.3,
      w * 0.5, h * 0.5, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
