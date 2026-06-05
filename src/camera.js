// camera.js — the follow-camera.
// Tracks a world-space target and exposes a transform the renderer applies so
// the world scrolls while the creature stays roughly framed. Keeps the creature
// biased toward the upper portion of the screen so you can see what's below as
// you descend into the abyss.

import { lerp, smoothFactor } from './utils.js';

export class Camera {
  constructor() {
    this.x = 0;            // world-space top-left of the view
    this.y = 0;
    this.smoothing = 0.09; // how tightly the camera chases the target
    this.verticalBias = 0.4; // target sits 40% down the screen (more visible below)
    this.shake = 0;       // current shake intensity (px)
  }

  /** Kick the camera into a shake (keeps the strongest pending intensity). */
  triggerShake(intensity) {
    if (intensity > this.shake) this.shake = intensity;
  }

  /** Decay the shake over time (frame-rate independent). */
  updateShake(deltaTime) {
    this.shake *= Math.pow(0.85, deltaTime / 16.6667);
    if (this.shake < 0.1) this.shake = 0;
  }

  /** Where the view's top-left should be to frame the target. */
  _desired(targetX, targetY, viewW, viewH) {
    return {
      x: targetX - viewW / 2,
      y: targetY - viewH * this.verticalBias,
    };
  }

  /** Jump instantly to frame the target (used at startup, no easing). */
  snapTo(targetX, targetY, viewW, viewH) {
    const d = this._desired(targetX, targetY, viewW, viewH);
    this.x = d.x;
    this.y = d.y;
  }

  /** Ease toward framing the target, frame-rate independent. */
  follow(targetX, targetY, viewW, viewH, deltaTime) {
    const d = this._desired(targetX, targetY, viewW, viewH);
    const t = smoothFactor(this.smoothing, deltaTime);
    this.x = lerp(this.x, d.x, t);
    this.y = lerp(this.y, d.y, t);
  }

  /** Shift the context into world space (plus any active shake). */
  apply(ctx) {
    let ox = 0, oy = 0;
    if (this.shake > 0.1) {
      ox = (Math.random() * 2 - 1) * this.shake;
      oy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.translate(-this.x + ox, -this.y + oy);
  }
}
