// player.js — the player's creature, now a physics body.
// A bioluminescent organism: softly morphing membrane, glowing rim, drifting
// nucleus, twinkling photophores. Moves with momentum through the water —
// buoyant sink + drag — steered (temporarily) by hold-to-thrust. Milestone 6
// replaces that with charge-and-release Pulse-Jet.

import { hexToRgba } from './utils.js';

export class Player {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // World-space position. The camera frames the view around this.
    this.x = (canvas.clientWidth || window.innerWidth) / 2;
    this.y = (canvas.clientHeight || window.innerHeight) / 2;

    // --- Physics body ---
    this.vx = 0;
    this.vy = 0;
    this.sinkAccel = 0.018;    // gentle downward buoyant pull (px / frame²)
    this.thrustAccel = 0.55;   // TEMP hold-to-thrust strength (replaced in M6)
    this.drag = 0.94;          // water resistance per ~16.67ms frame (0..1)
    this.maxSpeed = 14;        // clamp so motion never runs away

    this.size = 20;
    this.color = '#5de4f5';
    this.glowColor = '#5de4f5';
    this.accentColor = '#d7fbff';
    this.pulseSpeed = 1.0;

    this.maxTrail = 22;
    this.trailPoints = [];

    // Membrane harmonics — each ripple's strength waxes/wanes on its own slow
    // timer so the silhouette keeps morphing through different forms.
    this.membrane = [
      { freq: 3, amp: 0.085, speed: 0.0011, phase: Math.random() * Math.PI * 2, modSpeed: 0.00033, modPhase: Math.random() * Math.PI * 2 },
      { freq: 5, amp: 0.055, speed: 0.0016, phase: Math.random() * Math.PI * 2, modSpeed: 0.00047, modPhase: Math.random() * Math.PI * 2 },
      { freq: 2, amp: 0.045, speed: 0.0008, phase: Math.random() * Math.PI * 2, modSpeed: 0.00026, modPhase: Math.random() * Math.PI * 2 },
      { freq: 4, amp: 0.035, speed: 0.0013, phase: Math.random() * Math.PI * 2, modSpeed: 0.00039, modPhase: Math.random() * Math.PI * 2 },
    ];

    // Photophores — tiny internal light cells suspended inside the body.
    this.photophores = [];
    for (let i = 0; i < 6; i++) {
      this.photophores.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.2 + Math.random() * 0.5,
        size: 0.06 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Advance the physics body. `input` = { thrusting, aimX, aimY } in WORLD
   * coordinates (main.js converts the cursor via the camera).
   */
  update(deltaTime, input) {
    const dtf = deltaTime / 16.6667;

    // Buoyant sink — the world's gentle "gravity".
    this.vy += this.sinkAccel * dtf;

    // TEMPORARY control to feel the physics: hold to thrust toward the aim.
    // Milestone 6 replaces this with charge-and-release Pulse-Jet.
    if (input && input.thrusting) {
      const dx = input.aimX - this.x;
      const dy = input.aimY - this.y;
      const len = Math.hypot(dx, dy) || 1;
      this.vx += (dx / len) * this.thrustAccel * dtf;
      this.vy += (dy / len) * this.thrustAccel * dtf;
    }

    // Water drag (frame-rate independent), then clamp top speed.
    const drag = Math.pow(this.drag, dtf);
    this.vx *= drag;
    this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.maxSpeed) {
      this.vx = (this.vx / sp) * this.maxSpeed;
      this.vy = (this.vy / sp) * this.maxSpeed;
    }

    // Integrate position, then record the world-space trail.
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;
    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > this.maxTrail) this.trailPoints.shift();
  }

  /** Trace the organic (non-circular) membrane outline as a closed path. */
  _traceBody(ctx, cx, cy, radius, now) {
    const SEG = 48;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      let rMul = 1;
      for (const m of this.membrane) {
        const amp = m.amp * (0.55 + 0.45 * Math.sin(now * m.modSpeed + m.modPhase));
        rMul += amp * Math.sin(a * m.freq + now * m.speed + m.phase);
      }
      const r = radius * rMul;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  draw(ctx) {
    const now = Date.now();
    const pulse = Math.sin(now * 0.003 * this.pulseSpeed) * 3;
    const radius = Math.max(2, this.size + pulse);
    const flicker = 0.82 + 0.18 * (0.6 * Math.sin(now * 0.0021) +
                                   0.4 * Math.sin(now * 0.0039 + 1.3));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Trail — older points smaller and fainter, tapering to the head.
    const n = this.trailPoints.length;
    for (let i = 0; i < n; i++) {
      const p = this.trailPoints[i];
      const ratio = (i + 1) / n;
      const r = radius * (0.2 + 0.65 * ratio);
      const alpha = 0.09 * ratio;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, hexToRgba(this.glowColor, alpha));
      g.addColorStop(1, hexToRgba(this.glowColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Ambient halo — wide soft glow, gently flickering.
    const haloR = radius * 4.2;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, haloR);
    halo.addColorStop(0, hexToRgba(this.glowColor, 0.30 * flicker));
    halo.addColorStop(0.4, hexToRgba(this.glowColor, 0.10 * flicker));
    halo.addColorStop(1, hexToRgba(this.glowColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Membrane body — organic blob with a rich multi-stop gradient.
    ctx.beginPath();
    this._traceBody(ctx, this.x, this.y, radius * 1.04, now);
    const body = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius * 1.15);
    body.addColorStop(0.0, hexToRgba('#ffffff', 0.95));
    body.addColorStop(0.22, hexToRgba(this.accentColor, 0.85));
    body.addColorStop(0.5, hexToRgba(this.color, 0.7));
    body.addColorStop(0.82, hexToRgba(this.color, 0.32));
    body.addColorStop(1.0, hexToRgba(this.color, 0.0));
    ctx.fillStyle = body;
    ctx.fill();

    // 4. Glowing rim — bright blurred membrane edge.
    ctx.save();
    ctx.beginPath();
    this._traceBody(ctx, this.x, this.y, radius, now);
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = hexToRgba(this.accentColor, 0.6 * flicker);
    ctx.stroke();
    ctx.restore();

    // 5. Inner nucleus — soft secondary glow drifting off-centre.
    const nx = this.x + Math.sin(now * 0.0006) * radius * 0.18;
    const ny = this.y + Math.cos(now * 0.0008) * radius * 0.15;
    const nucR = radius * 0.55;
    const nucleus = ctx.createRadialGradient(nx, ny, 0, nx, ny, nucR);
    nucleus.addColorStop(0, hexToRgba('#ffffff', 0.55 * flicker));
    nucleus.addColorStop(0.5, hexToRgba(this.accentColor, 0.22 * flicker));
    nucleus.addColorStop(1, hexToRgba(this.accentColor, 0));
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.arc(nx, ny, nucR, 0, Math.PI * 2);
    ctx.fill();

    // 6. Photophores — tiny internal light cells that twinkle and slowly rotate.
    const spin = now * 0.0003;
    for (const ph of this.photophores) {
      const a = ph.angle + spin;
      const px = this.x + Math.cos(a) * ph.dist * radius;
      const py = this.y + Math.sin(a) * ph.dist * radius;
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.004 + ph.phase));
      const pr = Math.max(0.8, ph.size * radius);
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, hexToRgba('#ffffff', 0.9 * twinkle));
      g.addColorStop(0.6, hexToRgba(this.accentColor, 0.4 * twinkle));
      g.addColorStop(1, hexToRgba(this.accentColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
