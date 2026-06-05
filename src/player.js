// player.js — the player's creature.
// Owns position, smooth movement toward the cursor, the comet trail, the glow,
// and the gentle pulse. The evolution system (Wisp -> Jellyling -> Glowfin ->
// Deepmanta) arrives in Milestone 6.

import { lerp, clamp, hexToRgba, smoothFactor } from './utils.js';

export class Player {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Start at the screen centre (logical/CSS pixels).
    const cx = (canvas.clientWidth || window.innerWidth) / 2;
    const cy = (canvas.clientHeight || window.innerHeight) / 2;
    this.x = cx;
    this.y = cy;
    this.targetX = cx;
    this.targetY = cy;

    this.size = 20;          // current radius in CSS pixels (grows in M4)
    this.speed = 4;          // retained for guide fidelity / future tuning
    this.smoothing = 0.16;   // glide easing strength (per 16.67ms)

    this.color = '#5de4f5';       // body tint
    this.glowColor = '#5de4f5';   // halo / trail tint
    this.pulseSpeed = 1.0;        // breathing rate (varies per evolution later)

    // Comet trail: most-recent position is last in the array.
    this.maxTrail = 22;
    this.trailPoints = [];
  }

  /**
   * Ease toward the target each frame (frame-rate independent) and record the
   * trail. Recording every frame and capping the length is what makes the tail
   * gracefully retract into the body when the player stops moving.
   */
  update(deltaTime) {
    const t = smoothFactor(this.smoothing, deltaTime);
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);

    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > this.maxTrail) {
      this.trailPoints.shift();
    }
  }

  /**
   * Render the creature. Drawn in additive ('lighter') blend so overlapping
   * light accumulates and genuinely glows, then layered:
   *   1. the comet trail (soft tapering blobs, tail -> head)
   *   2. a wide ambient halo that lights the surrounding water
   *   3. the white-hot core with a shadowBlur bloom
   */
  draw(ctx) {
    // Gentle breathing pulse on the radius (±3px), even when stationary.
    const pulse = Math.sin(Date.now() * 0.003 * this.pulseSpeed) * 3;
    const radius = Math.max(2, this.size + pulse);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Trail — older points are smaller and fainter, tapering to the head.
    const n = this.trailPoints.length;
    for (let i = 0; i < n; i++) {
      const p = this.trailPoints[i];
      const ratio = (i + 1) / n;                 // ~0 (oldest) .. 1 (newest)
      const r = radius * (0.2 + 0.65 * ratio);
      const alpha = 0.10 * ratio;                // modest so it never blows out
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, hexToRgba(this.glowColor, alpha));
      g.addColorStop(1, hexToRgba(this.glowColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Ambient halo — a large soft glow bleeding into the dark water.
    const haloR = radius * 4.2;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, haloR);
    halo.addColorStop(0, hexToRgba(this.glowColor, 0.35));
    halo.addColorStop(0.4, hexToRgba(this.glowColor, 0.12));
    halo.addColorStop(1, hexToRgba(this.glowColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. Core — white-hot centre fading to glowColor, with a bloom shadow.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 35;
    const core = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, this.color);
    core.addColorStop(1, hexToRgba(this.color, 0.55));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
