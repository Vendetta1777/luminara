// player.js — the player's creature.
// A bioluminescent organism (not a hard disc): a softly morphing membrane with
// a glowing rim, an uneven inner glow, drifting photophores, and an irregular
// shimmer. Owns movement toward the cursor, the comet trail, and the pulse.
// The evolution system (Wisp -> Jellyling -> Glowfin -> Deepmanta) arrives in M6.

import { lerp, hexToRgba, smoothFactor } from './utils.js';

export class Player {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

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
    this.glowColor = '#5de4f5';   // halo / trail / rim tint
    this.accentColor = '#d7fbff'; // pale highlight for rim + nucleus
    this.pulseSpeed = 1.0;        // breathing rate (varies per evolution later)

    // Comet trail: most-recent position is last in the array.
    this.maxTrail = 22;
    this.trailPoints = [];

    // Per-creature membrane harmonics — random phases so two creatures never
    // wobble identically. Three layered sines give an organic, non-circular edge.
    this.membrane = [
      { freq: 3, amp: 0.07, speed: 0.0011, phase: Math.random() * Math.PI * 2 },
      { freq: 5, amp: 0.045, speed: 0.0016, phase: Math.random() * Math.PI * 2 },
      { freq: 2, amp: 0.035, speed: 0.0008, phase: Math.random() * Math.PI * 2 },
    ];

    // Photophores — tiny internal light cells suspended inside the body.
    this.photophores = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      this.photophores.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.2 + Math.random() * 0.5,   // fraction of radius from centre
        size: 0.06 + Math.random() * 0.08, // fraction of radius
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(deltaTime) {
    const t = smoothFactor(this.smoothing, deltaTime);
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);

    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > this.maxTrail) {
      this.trailPoints.shift();
    }
  }

  /** Trace the organic (non-circular) membrane outline as a closed path. */
  _traceBody(ctx, cx, cy, radius, now) {
    const SEG = 48;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      let rMul = 1;
      for (const m of this.membrane) {
        rMul += m.amp * Math.sin(a * m.freq + now * m.speed + m.phase);
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

    // Breathing pulse (±3px) plus an irregular two-wave shimmer for the glow.
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

    // 2. Ambient halo — wide soft glow bleeding into the water, gently flickering.
    const haloR = radius * 4.2;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, haloR);
    halo.addColorStop(0, hexToRgba(this.glowColor, 0.30 * flicker));
    halo.addColorStop(0.4, hexToRgba(this.glowColor, 0.10 * flicker));
    halo.addColorStop(1, hexToRgba(this.glowColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Membrane body — organic blob filled with a rich multi-stop gradient
    //    (translucent gelatinous look, not a flat 2-tone disc).
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

    // 4. Glowing rim — a bright, blurred membrane edge so the silhouette emits
    //    light, like a jelly catching the glow.
    ctx.save();
    ctx.beginPath();
    this._traceBody(ctx, this.x, this.y, radius, now);
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = hexToRgba(this.accentColor, 0.6 * flicker);
    ctx.stroke();
    ctx.restore();

    // 5. Inner nucleus — a soft secondary glow that drifts off-centre so the
    //    body never looks perfectly concentric.
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
